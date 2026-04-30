"use client";
import { useState } from "react";

const FEATURES = [
  { id: "thread_recommend", label: "Thread 추천 받기" },
  { id: "summarize", label: "활동 요약 제안" },
  { id: "extract_actions", label: "액션아이템 자동 추출" },
  { id: "recommend", label: "다음 할 일 제안" },
  { id: "cross_thread_alert", label: "정체/이상 경보 받기" },
];

export function AIPreferencesClient({ initial }: { initial: { enabled: boolean; features: string[] } }) {
  const [enabled, setEnabled] = useState<boolean>(initial.enabled !== false);
  const [features, setFeatures] = useState<string[]>(initial.features || []);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const toggleFeature = (id: string) => {
    setFeatures((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  };

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/profile/ai-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, features }),
      });
      if (res.ok) setMsg("저장됨");
      else { const j = await res.json(); setMsg(j.error || "오류"); }
    } catch (e: any) { setMsg(e.message); }
    finally { setSaving(false); }
  };

  const allOff = !enabled;

  return (
    <div className="border-[3px] border-nu-ink bg-white p-4 space-y-4 shadow-[3px_3px_0_0_#0D0F14]">
      <label className="flex items-center gap-2 border-b-[2px] border-nu-ink pb-3">
        <input type="checkbox" checked={!enabled} onChange={(e) => setEnabled(!e.target.checked)} className="w-4 h-4" />
        <span className="font-bold text-nu-ink">🛑 모두 끄기 (AI 도움 받지 않음)</span>
      </label>

      {!allOff && (
        <div className="space-y-2">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">개별 기능</div>
          {FEATURES.map((f) => (
            <label key={f.id} className="flex items-center gap-2 border-[2px] border-nu-ink/40 px-2 py-1">
              <input type="checkbox" checked={features.includes(f.id)} onChange={() => toggleFeature(f.id)} className="w-4 h-4" />
              <span className="text-sm">{f.label}</span>
            </label>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t-[2px] border-nu-ink">
        <button onClick={save} disabled={saving}
          className="border-[3px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[11px] uppercase tracking-widest font-bold px-4 py-2 shadow-[3px_3px_0_0_#0D0F14] disabled:opacity-50">
          {saving ? "저장 중..." : "저장"}
        </button>
        {msg && <span className="text-xs font-mono">{msg}</span>}
      </div>
    </div>
  );
}
