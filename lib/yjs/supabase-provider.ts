/**
 * SupabaseYjsProvider
 * ------------------------------------------------------------------
 * Minimal Yjs transport built on Supabase Realtime broadcast channels
 * + bytea persistence via /api/yjs/[docId].
 *
 * Architecture:
 *   ┌──────────────┐                  ┌──────────────┐
 *   │ Y.Doc (tab A)│ ── update ──┐    │ Y.Doc (tab B)│
 *   └──────────────┘             │    └──────────────┘
 *          ▲                     ▼            ▲
 *          │            Supabase Realtime     │
 *          │            broadcast: yjs:{doc}  │
 *          │                     │            │
 *          │       ┌─────────────┴───────────┐│
 *          └─ load │  POST /api/yjs/{docId}  │┘ debounced 5s
 *           snapshot│  GET  /api/yjs/{docId}  │
 *                  └─────────────────────────┘
 *                              │
 *                       postgres: yjs_documents (bytea)
 *
 * Scope: personal notes only — every keystroke is broadcast as a small
 * delta. Snapshot is debounced to keep DB writes cheap. Good enough for
 * one user across two tabs / a single note shared with a few people.
 * For thousands of concurrent editors, replace with Hocuspocus.
 */

import * as Y from "yjs";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

type Status = "connecting" | "synced" | "saving" | "offline";

export interface SupabaseYjsProviderOpts {
  doc: Y.Doc;
  docId: string;
  supabase: SupabaseClient;
  /** debounced snapshot save (ms) */
  saveDebounceMs?: number;
  onStatus?: (status: Status) => void;
  onPresence?: (count: number) => void;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  // btoa exists in browsers
  return typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export class SupabaseYjsProvider {
  doc: Y.Doc;
  docId: string;
  supabase: SupabaseClient;
  channel: RealtimeChannel | null = null;
  status: Status = "connecting";
  private destroyed = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private saveDebounceMs: number;
  private onStatus?: (s: Status) => void;
  private onPresence?: (n: number) => void;
  private originTag = Symbol("supabase-yjs-provider");
  private updateHandler: (update: Uint8Array, origin: unknown) => void;

  constructor(opts: SupabaseYjsProviderOpts) {
    this.doc = opts.doc;
    this.docId = opts.docId;
    this.supabase = opts.supabase;
    this.saveDebounceMs = opts.saveDebounceMs ?? 5000;
    this.onStatus = opts.onStatus;
    this.onPresence = opts.onPresence;

    this.updateHandler = (update: Uint8Array, origin: unknown) => {
      // Don't echo updates we just applied from remote.
      if (origin === this.originTag) return;
      this.broadcastUpdate(update);
      this.scheduleSave();
    };
  }

  private setStatus(s: Status) {
    if (this.status === s) return;
    this.status = s;
    this.onStatus?.(s);
  }

  async start(): Promise<void> {
    this.setStatus("connecting");

    // 1. Load latest snapshot (best-effort)
    try {
      const res = await fetch(`/api/yjs/${encodeURIComponent(this.docId)}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json?.state) {
          const bytes = base64ToBytes(json.state);
          Y.applyUpdate(this.doc, bytes, this.originTag);
        }
      }
    } catch {
      // non-fatal; offline-first works
    }

    // 2. Subscribe to broadcast channel
    const channel = this.supabase.channel(`yjs:${this.docId}`, {
      config: { broadcast: { self: false }, presence: { key: "" } },
    });

    channel.on("broadcast", { event: "update" }, (payload) => {
      try {
        const b64 = (payload?.payload as { update?: string } | undefined)?.update;
        if (!b64) return;
        const bytes = base64ToBytes(b64);
        Y.applyUpdate(this.doc, bytes, this.originTag);
      } catch {
        /* ignore malformed payloads */
      }
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const count = Object.keys(state).length;
      this.onPresence?.(count);
    });

    await new Promise<void>((resolve) => {
      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          this.setStatus("synced");
          // Track our own presence (best-effort)
          try {
            await channel.track({ online_at: new Date().toISOString() });
          } catch {}
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "CLOSED" || status === "TIMED_OUT") {
          this.setStatus("offline");
        }
      });
    });

    this.channel = channel;

    // 3. Listen for local changes
    this.doc.on("update", this.updateHandler);
  }

  private broadcastUpdate(update: Uint8Array) {
    if (!this.channel) return;
    this.channel
      .send({ type: "broadcast", event: "update", payload: { update: bytesToBase64(update) } })
      .catch(() => this.setStatus("offline"));
  }

  private scheduleSave() {
    if (this.destroyed) return;
    this.setStatus("saving");
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.persistSnapshot(), this.saveDebounceMs);
  }

  private async persistSnapshot() {
    if (this.destroyed) return;
    try {
      const update = Y.encodeStateAsUpdate(this.doc);
      const b64 = bytesToBase64(update);
      const res = await fetch(`/api/yjs/${encodeURIComponent(this.docId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: b64 }),
      });
      if (!res.ok) throw new Error(`save failed: ${res.status}`);
      this.setStatus("synced");
    } catch {
      this.setStatus("offline");
    }
  }

  /** Force-save now (e.g. before unmount). */
  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.persistSnapshot();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.doc.off("update", this.updateHandler);
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.channel) {
      try {
        this.supabase.removeChannel(this.channel);
      } catch {}
      this.channel = null;
    }
  }
}
