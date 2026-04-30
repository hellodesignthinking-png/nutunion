"use client";

/**
 * YjsTextarea
 * ------------------------------------------------------------------
 * A lightweight Yjs-backed textarea for personal notes.
 *
 * Why a textarea (not Tiptap) here: keeps the existing markdown UX,
 * toolbar, and preview pipeline working unchanged. We only swap the
 * source of truth from React state → Y.Text (which then mirrors back
 * into React state via the `onChange` prop).
 *
 * Strategy: every local edit computes a minimal common-prefix /
 * common-suffix diff against the Y.Text contents and applies a single
 * (delete, insert) pair. That is conflict-free at the CRDT level
 * (Y.Text resolves concurrent edits) and has good caret behaviour
 * because the diff window is small for typical typing.
 *
 * Status callback reports: "connecting" | "synced" | "saving" | "offline"
 * Presence callback reports the number of clients in the Realtime room.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as Y from "yjs";
import { createClient } from "@/lib/supabase/client";
import { SupabaseYjsProvider } from "@/lib/yjs/supabase-provider";

type Status = "connecting" | "synced" | "saving" | "offline";

interface Props {
  docId: string;                 // e.g. `personal_notes:${noteId}`
  initialValue: string;          // seed Y.Text on first mount if empty
  value: string;                 // controlled mirror (React state)
  onChange: (next: string) => void;
  onStatusChange?: (status: Status) => void;
  onPresenceCount?: (count: number) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
}

function diff(prev: string, next: string): { index: number; remove: number; insert: string } {
  // Find common prefix
  let start = 0;
  const max = Math.min(prev.length, next.length);
  while (start < max && prev.charCodeAt(start) === next.charCodeAt(start)) start++;
  // Find common suffix
  let endPrev = prev.length;
  let endNext = next.length;
  while (
    endPrev > start &&
    endNext > start &&
    prev.charCodeAt(endPrev - 1) === next.charCodeAt(endNext - 1)
  ) {
    endPrev--;
    endNext--;
  }
  return {
    index: start,
    remove: endPrev - start,
    insert: next.slice(start, endNext),
  };
}

export const YjsTextarea = forwardRef<HTMLTextAreaElement, Props>(function YjsTextarea(
  { docId, initialValue, value, onChange, onStatusChange, onPresenceCount, onBlur, placeholder, className },
  ref
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<SupabaseYjsProvider | null>(null);
  const ytextRef = useRef<Y.Text | null>(null);
  // Last value we *applied to ytext locally* — prevents re-applying our own change as remote.
  const lastLocalRef = useRef<string>(value);
  // Origin tag distinguishing local user edits from remote applyUpdate.
  const localOriginRef = useRef<symbol>(Symbol("local"));

  // Mount: create doc + provider
  useEffect(() => {
    const doc = new Y.Doc();
    const ytext = doc.getText("content");
    docRef.current = doc;
    ytextRef.current = ytext;

    const supabase = createClient();
    const provider = new SupabaseYjsProvider({
      doc,
      docId,
      supabase,
      onStatus: (s) => onStatusChange?.(s),
      onPresence: (n) => onPresenceCount?.(n),
    });
    providerRef.current = provider;

    let cancelled = false;
    provider.start().then(() => {
      if (cancelled) return;
      // Seed if remote is empty AND we have initial content
      if (ytext.length === 0 && initialValue) {
        doc.transact(() => {
          ytext.insert(0, initialValue);
        }, localOriginRef.current);
      }
      // Push initial state up to React
      const text = ytext.toString();
      lastLocalRef.current = text;
      if (text !== value) onChange(text);
    });

    // Observe remote-or-local-doc changes and mirror to React state
    const obs = (_event: Y.YTextEvent, tx: Y.Transaction) => {
      const text = ytext.toString();
      if (text === lastLocalRef.current) return;
      lastLocalRef.current = text;
      // Mirror only if it differs from current React-controlled value.
      onChange(text);
      // Note: tx.local is true for local transactions. We mirror both —
      // it's idempotent since we compare with lastLocalRef.
      void tx;
    };
    ytext.observe(obs);

    return () => {
      cancelled = true;
      ytext.unobserve(obs);
      provider.flush().finally(() => {
        provider.destroy();
        doc.destroy();
      });
      providerRef.current = null;
      docRef.current = null;
      ytextRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  // Local edit handler — compute diff and apply to Y.Text
  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    const ytext = ytextRef.current;
    const doc = docRef.current;
    if (!ytext || !doc) {
      // Provider not ready yet — fall back to plain controlled update.
      onChange(next);
      return;
    }
    const current = ytext.toString();
    if (next === current) {
      onChange(next);
      return;
    }
    const d = diff(current, next);
    doc.transact(() => {
      if (d.remove > 0) ytext.delete(d.index, d.remove);
      if (d.insert.length > 0) ytext.insert(d.index, d.insert);
    }, localOriginRef.current);
    lastLocalRef.current = next;
    onChange(next);
  }

  return (
    <textarea
      ref={innerRef}
      value={value}
      onChange={handleChange}
      onBlur={onBlur}
      placeholder={placeholder}
      className={className}
    />
  );
});
