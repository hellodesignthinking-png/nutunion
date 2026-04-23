"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Copy, Pencil, RefreshCw, Check, MoreHorizontal, X } from "lucide-react";
import type { DevPlan } from "@/lib/genesis/dev-plan-schema";

export function DevPlanActions({
  projectId,
  intent,
  isHost,
  editMode,
  onToggleEdit,
}: {
  projectId: string;
  intent: string | null;
  isHost: boolean;
  editMode: boolean;
  onToggleEdit: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function handlePrint() {
    if (typeof window !== "undefined") window.print();
  }

  async function handleCopy() {
    try {
      const url = typeof window !== "undefined" ? window.location.href : "";
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("복사 실패 — URL을 수동으로 복사해주세요");
    }
  }

  async function handleRegenerate() {
    if (!intent) {
      alert("기존 의도(intent) 가 없어 재생성할 수 없습니다. Genesis AI 에서 새로 시작해주세요.");
      return;
    }
    if (!confirm("기존 로드맵을 덮어쓰고 다시 생성할까요?")) return;
    setRegenerating(true);
    try {
      const r = await fetch("/api/genesis/dev-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, projectId }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || "재생성 실패");
      }
      startTransition(() => router.refresh());
    } catch (e: any) {
      alert(e?.message || "재생성 실패");
    } finally {
      setRegenerating(false);
    }
  }

  const buttons = (
    <>
      <button
        onClick={handlePrint}
        className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 border-[2px] border-nu-ink bg-nu-paper text-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-colors inline-flex items-center gap-1.5 w-full md:w-auto justify-center"
      >
        <Download size={12} /> PDF 내보내기
      </button>
      <button
        onClick={handleCopy}
        className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 border-[2px] border-nu-ink bg-nu-paper text-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-colors inline-flex items-center gap-1.5 w-full md:w-auto justify-center"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? "복사됨" : "팀 공유 링크 복사"}
      </button>
      {isHost && (
        <button
          onClick={onToggleEdit}
          className={`font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 border-[2px] border-nu-ink transition-colors inline-flex items-center gap-1.5 w-full md:w-auto justify-center ${
            editMode
              ? "bg-nu-pink text-nu-paper"
              : "bg-nu-paper text-nu-ink hover:bg-nu-ink hover:text-nu-paper"
          }`}
        >
          <Pencil size={12} /> {editMode ? "편집 종료" : "편집 모드"}
        </button>
      )}
      {isHost && (
        <button
          onClick={handleRegenerate}
          disabled={regenerating || isPending}
          className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 border-[2px] border-nu-ink bg-nu-cream text-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 w-full md:w-auto justify-center"
        >
          <RefreshCw size={12} className={regenerating ? "animate-spin" : ""} />
          {regenerating ? "재생성 중…" : "다시 생성"}
        </button>
      )}
    </>
  );

  return (
    <div className="print:hidden mb-6">
      {/* Desktop: horizontal row */}
      <div className="hidden md:flex flex-wrap items-center gap-2">
        {buttons}
      </div>
      {/* Mobile: dropdown */}
      <div className="md:hidden">
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="w-full font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 border-[2px] border-nu-ink bg-nu-paper text-nu-ink inline-flex items-center justify-center gap-1.5"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={12} /> : <MoreHorizontal size={12} />}
          {mobileOpen ? "닫기" : "⋯ 더보기"}
        </button>
        {mobileOpen && (
          <div className="mt-2 flex flex-col gap-2 border-[2px] border-nu-ink bg-nu-cream/40 p-2">
            {buttons}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * EditableNarrative — host-only inline textarea for narrative fields.
 * On blur, sends a full plan replacement via PATCH.
 */
export function EditableNarrative({
  projectId,
  plan,
  path,
  editMode,
  className = "",
}: {
  projectId: string;
  plan: DevPlan;
  path: (string | number)[];
  editMode: boolean;
  className?: string;
}) {
  const initial = String(getAt(plan, path) ?? "");
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const router = useRouter();

  async function save() {
    if (value === initial) return;
    setSaving(true);
    try {
      const next = cloneAndSet(plan, path, value);
      const r = await fetch(`/api/genesis/dev-plan/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patch: { __replace: true, plan: next } }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || "저장 실패");
      }
      setSavedAt(Date.now());
      router.refresh();
    } catch (e: any) {
      alert(e?.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  if (!editMode) {
    return <span className={className}>{initial}</span>;
  }

  return (
    <span className="inline-block w-full align-top">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        rows={Math.max(2, Math.ceil((value.length || 1) / 60))}
        className={`${className} w-full border-[2px] border-nu-pink bg-nu-paper px-2 py-1 focus:outline-none focus:border-nu-ink`}
      />
      {saving && (
        <span className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
          저장 중…
        </span>
      )}
      {!saving && savedAt && (
        <span className="block font-mono-nu text-[10px] uppercase tracking-widest text-green-700">
          저장됨
        </span>
      )}
    </span>
  );
}

function getAt(obj: any, path: (string | number)[]): any {
  let cur = obj;
  for (const k of path) {
    if (cur == null) return undefined;
    cur = cur[k as any];
  }
  return cur;
}

function cloneAndSet(obj: any, path: (string | number)[], value: any): any {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  if (Array.isArray(obj)) {
    const copy = obj.slice();
    copy[head as number] = cloneAndSet(obj[head as number], rest, value);
    return copy;
  }
  const base = obj && typeof obj === "object" ? { ...obj } : {};
  base[head as string] = cloneAndSet(base[head as string], rest, value);
  return base;
}
