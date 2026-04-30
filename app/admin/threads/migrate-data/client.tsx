"use client";
import { useEffect, useState } from "react";

type Status = { total: number; migrated: number; pending: number };
type AllStatus = { events: Status; meetings: Status; milestones: Status } | null;

const SOURCES = [
  { id: "events", label: "events → 📅 calendar thread_data", desc: "그룹의 이벤트를 calendar Thread 데이터로 복제" },
  { id: "meetings", label: "meetings → 📋 board thread_data", desc: "회의록을 게시판 글로 변환 (제목 prefix '회의:')" },
  { id: "milestones", label: "project_milestones → 🎯 milestone thread_data", desc: "프로젝트 마일스톤을 milestone Thread 로 복제" },
] as const;

export function MigrateDataClient() {
  const [status, setStatus] = useState<AllStatus>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const refresh = async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/threads/migrate-data", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) setError(json.error || "load_failed");
      else setStatus(json);
    } catch (e: any) { setError(e.message); }
  };

  useEffect(() => { refresh(); }, []);

  const run = async (source: string) => {
    setBusy(source); setError(null);
    try {
      const res = await fetch("/api/admin/threads/migrate-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, batch: 50 }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "migrate_failed");
        setLog((l) => [`[${source}] FAIL: ${json.error}`, ...l]);
      } else {
        setLog((l) => [`[${source}] processed=${json.processed} inserted=${json.inserted} skipped=${json.skipped}`, ...l]);
        await refresh();
      }
    } catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="border-[3px] border-amber-500 bg-amber-50 p-3 font-mono text-sm">{error}</div>
      )}

      <div className="border-[3px] border-nu-ink bg-white p-3 text-xs font-mono space-y-1">
        <div className="font-mono-nu uppercase tracking-widest text-[10px] text-nu-muted">안전성 (Safety)</div>
        <ul className="list-disc list-inside text-nu-muted">
          <li>원본 테이블(events / meetings / project_milestones)은 <b>건드리지 않음</b>.</li>
          <li>중복 실행해도 <code>data.legacy_id + legacy_table</code> 로 자동 dedup.</li>
          <li>롤백: <code>delete from thread_data where data-{">"}{">"} 'legacy_table' = 'X'</code> 한 줄로 가능.</li>
        </ul>
      </div>

      {SOURCES.map((s) => {
        const st = status?.[s.id as keyof NonNullable<AllStatus>] as Status | undefined;
        return (
          <div key={s.id} className="border-[3px] border-nu-ink bg-white p-4 shadow-[3px_3px_0_0_#0D0F14] space-y-2">
            <div className="font-bold text-nu-ink">{s.label}</div>
            <div className="text-xs font-mono text-nu-muted">{s.desc}</div>
            {st ? (
              <div className="font-mono text-sm">
                총 <b>{st.total}</b>건 / 이전 완료 <b>{st.migrated}</b>건 / 대기 <b className="text-nu-pink">{st.pending}</b>건
              </div>
            ) : (
              <div className="text-xs font-mono text-nu-muted">로딩...</div>
            )}
            <button onClick={() => run(s.id)} disabled={busy !== null || (st?.pending === 0)}
              className="border-[3px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[11px] uppercase tracking-widest font-bold px-3 py-1.5 shadow-[2px_2px_0_0_#0D0F14] disabled:opacity-50">
              {busy === s.id ? "처리 중..." : "일괄 이전 (50건 배치)"}
            </button>
          </div>
        );
      })}

      {log.length > 0 && (
        <div className="border-[3px] border-nu-ink bg-black text-green-400 p-3 font-mono text-xs space-y-0.5 max-h-60 overflow-auto">
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}
