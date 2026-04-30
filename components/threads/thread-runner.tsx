"use client";
import { useEffect, useRef, useState } from "react";
import { registry, type ThreadInstallation } from "@/lib/threads/registry";
import { GenericThread } from "@/components/threads/generic-thread";
// Side-effect: loads all Thread definitions.
import "@/lib/threads/bootstrap";

interface Props {
  installation: ThreadInstallation;
  canEdit: boolean;
  currentUserId: string;
}

/**
 * CodeThreadIframe — runs Level 3 (code-mode) Threads inside a sandboxed iframe.
 * The iframe loads compiled JS from /api/threads/sandbox-preview/serve and we
 * pass installation props via postMessage. sandbox="allow-scripts" (no
 * allow-same-origin) keeps user code from touching parent DOM.
 */
function CodeThreadIframe({
  installation,
  currentUserId,
  canEdit,
}: {
  installation: ThreadInstallation;
  currentUserId: string;
  canEdit: boolean;
}) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(500);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      // Only accept messages from our own iframe child. Without this, any other iframe or
      // popup window on the page can fake thread-height to balloon the layout, or fake a
      // thread-ready to capture the next thread-init payload.
      if (!ref.current?.contentWindow || e.source !== ref.current.contentWindow) return;
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "thread-ready") {
        // The iframe runs sandbox=allow-scripts (no allow-same-origin) so its origin is
        // opaque ("null"). targetOrigin must therefore be "*" — but because we just verified
        // e.source above, only the legitimate iframe receives this message.
        ref.current.contentWindow.postMessage(
          {
            type: "thread-init",
            installation: {
              id: installation.id,
              target_type: installation.target_type,
              target_id: installation.target_id,
              config: installation.config || {},
            },
            currentUserId,
            canEdit,
          },
          "*",
        );
      } else if (e.data.type === "thread-height" && typeof e.data.height === "number") {
        setHeight(Math.max(200, Math.min(2000, e.data.height + 16)));
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [installation, currentUserId, canEdit]);

  return (
    <div className="w-full border-[3px] border-nu-ink/20 bg-white">
      <iframe
        ref={ref}
        src={`/api/threads/sandbox-preview/serve?installation_id=${encodeURIComponent(installation.id)}`}
        sandbox="allow-scripts"
        className="w-full"
        style={{ height: `${height}px` }}
        title={`Code Thread: ${installation.thread?.name || ""}`}
      />
    </div>
  );
}

export function ThreadRunner({ installation, canEdit, currentUserId }: Props) {
  const slug = installation.thread?.slug || "";

  const builderState = (installation.thread as any)?.builder_state;
  const uiComponent = (installation.thread as any)?.ui_component;

  // Level 3 (code-mode): render inside sandboxed iframe
  if (uiComponent === "__code__") {
    return (
      <CodeThreadIframe installation={installation} currentUserId={currentUserId} canEdit={canEdit} />
    );
  }

  // Custom Threads (no-code / ai-assist) use ui_component='__generic__'
  // and store their spec in builder_state on the thread row.
  if (uiComponent === "__generic__" && builderState && Array.isArray(builderState.fields)) {
    return (
      <div className="w-full">
        <GenericThread
          installation={installation}
          spec={{
            title: builderState.name || installation.thread?.name || "",
            description: builderState.description || installation.thread?.description || "",
            fields: builderState.fields || [],
            views: builderState.views || [{ kind: "list" }],
            actions: builderState.actions || [{ kind: "add", label: "추가" }],
          }}
        />
      </div>
    );
  }

  const def = registry.get(slug);
  if (!def) {
    return (
      <div className="border-[3px] border-nu-ink/20 bg-nu-cream/40 p-6 text-center">
        <p className="text-sm text-nu-muted">
          Thread 를 찾을 수 없어요 — slug: <code className="font-mono">{slug || "(empty)"}</code>
        </p>
      </div>
    );
  }
  const { Component } = def;
  return (
    <div className="w-full">
      <Component
        installation={installation}
        config={installation.config || {}}
        canEdit={canEdit}
        currentUserId={currentUserId}
      />
    </div>
  );
}
