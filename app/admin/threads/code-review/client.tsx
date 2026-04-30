"use client";
import { useState } from "react";

const BTN =
  "border-[3px] border-nu-ink font-mono-nu text-[11px] uppercase tracking-widest font-bold px-3 py-2 shadow-[3px_3px_0_0_#0D0F14] disabled:opacity-50";

interface Thread {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  description: string | null;
  is_public: boolean;
  is_draft: boolean;
  created_by: string | null;
  created_at: string;
  source_preview: string;
  source_length: number;
}

export function CodeReviewClient({ threads }: { threads: Thread[] }) {
  const [items, setItems] = useState(threads);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setPublic(id: string, makePublic: boolean) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/threads/code-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: id, is_public: makePublic }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "failed");
      setItems((prev) => prev.map((t) => (t.id === id ? { ...t, is_public: makePublic } : t)));
    } catch (e: any) {
      setError(e.message || "failed");
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="border-[3px] border-nu-ink/20 bg-white p-8 text-center text-sm text-nu-muted">
        검토 대기 중인 코드 Thread 가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="border-[3px] border-red-600 bg-red-50 p-3 font-mono-nu text-sm text-red-700">⚠️ {error}</div>
      )}
      {items.map((t) => (
        <div key={t.id} className="border-[3px] border-nu-ink bg-white">
          <div className="flex items-start justify-between p-4 gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="text-2xl shrink-0">{t.icon || "💻"}</span>
              <div className="min-w-0">
                <div className="font-bold truncate">{t.name}</div>
                <div className="text-[11px] font-mono-nu text-nu-muted">
                  /{t.slug} · {new Date(t.created_at).toLocaleDateString("ko-KR")} · {t.source_length} chars
                </div>
                {t.description && <div className="text-sm text-nu-muted mt-1">{t.description}</div>}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`border-2 px-2 py-1 text-[10px] font-mono-nu font-bold ${
                  t.is_public ? "border-green-600 text-green-700" : "border-orange-600 text-orange-700"
                }`}
              >
                {t.is_public ? "✅ 공개" : "🔒 비공개"}
              </span>
              <button onClick={() => setOpen(open === t.id ? null : t.id)} className={`${BTN} bg-white`}>
                {open === t.id ? "▲ 접기" : "▼ 코드 보기"}
              </button>
              <button
                onClick={() => setPublic(t.id, true)}
                disabled={busy === t.id || t.is_public}
                className={`${BTN} bg-green-600 text-white border-green-700`}
              >
                ✅ 승인
              </button>
              <button
                onClick={() => setPublic(t.id, false)}
                disabled={busy === t.id || !t.is_public}
                className={`${BTN} bg-red-600 text-white border-red-700`}
              >
                🚫 비활성화
              </button>
            </div>
          </div>
          {open === t.id && (
            <pre className="max-h-[480px] overflow-auto border-t-2 border-nu-ink/20 bg-[#0D0F14] p-4 font-mono text-[11px] text-[#C8A97E]">
              {t.source_preview || "(소스 없음)"}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
