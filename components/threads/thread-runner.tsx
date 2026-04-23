"use client";
import { registry, type ThreadInstallation } from "@/lib/threads/registry";
// Side-effect: loads all Thread definitions.
import "@/lib/threads/bootstrap";

interface Props {
  installation: ThreadInstallation;
  canEdit: boolean;
  currentUserId: string;
}

export function ThreadRunner({ installation, canEdit, currentUserId }: Props) {
  const slug = installation.thread?.slug || "";
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
