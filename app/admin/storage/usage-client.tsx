"use client";

/**
 * StorageUsageClient — admin 전용 R2 사용량 / Drive 사본 통계 패널.
 * 그룹/프로젝트 랭킹 + 방치된 Drive 사본 cleanup 트리거.
 */

import { useEffect, useState } from "react";
import { Loader2, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface UsageData {
  groups: Array<{ id: string; name: string; bytes: number; count: number }>;
  projects: Array<{ id: string; title: string; count: number }>;
  drive_edits: { total: number; stale_30d: number; stale_90d: number };
  versions: { count: number; bytes: number };
}

function fmtBytes(b: number): string {
  if (!b) return "0 B";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function StorageUsageClient() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleanupDays, setCleanupDays] = useState(90);
  const [cleanupBusy, setCleanupBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/storage/usage", { cache: "no-store" });
      const json = await r.json();
      if (!r.ok) {
        toast.error(json?.error || "조회 실패");
        return;
      }
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function cleanup(dryRun: boolean) {
    if (!dryRun && !confirm(`${cleanupDays}일 이상 방치된 Drive 사본을 휴지통 처리할까요?`)) return;
    setCleanupBusy(true);
    try {
      const r = await fetch("/api/admin/storage/cleanup-drive-edits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ older_than_days: cleanupDays, dry_run: dryRun }),
      });
      const json = await r.json();
      if (!r.ok) {
        toast.error(json?.error || "정리 실패");
        return;
      }
      if (dryRun) {
        toast(`대상 ${json.count}개 (실제 처리 안 함)`);
      } else {
        toast.success(`${json.db_cleaned}개 DB 정리 / Drive ${json.drive_ok}개 휴지통, ${json.drive_skipped}개 스킵`);
        await load();
      }
    } finally {
      setCleanupBusy(false);
    }
  }

  return (
    <div className="mt-10 border-t-[2px] border-nu-ink/10 pt-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink mb-1">사용량 · 정리</div>
          <h2 className="text-[18px] font-bold text-nu-ink">R2 / Drive 통계</h2>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink text-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-all flex items-center gap-1.5 disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          새로고침
        </button>
      </div>

      {!data ? (
        <div className="text-[12px] text-nu-muted">로딩 중...</div>
      ) : (
        <>
          {/* 요약 박스 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBox label="Drive 사본" value={data.drive_edits.total.toLocaleString()} />
            <StatBox label="30일 방치" value={data.drive_edits.stale_30d.toLocaleString()} accent={data.drive_edits.stale_30d > 0 ? "yellow" : undefined} />
            <StatBox label="90일 방치" value={data.drive_edits.stale_90d.toLocaleString()} accent={data.drive_edits.stale_90d > 0 ? "red" : undefined} />
            <StatBox label="버전 백업" value={`${data.versions.count} · ${fmtBytes(data.versions.bytes)}`} />
          </div>

          {/* 그룹 랭킹 */}
          <div className="border-2 border-nu-ink/10">
            <div className="px-4 py-2 bg-nu-cream/30 border-b-2 border-nu-ink/10">
              <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink font-bold">그룹 R2 사용량 TOP 10</span>
            </div>
            <table className="w-full text-[12px]">
              <thead className="bg-nu-cream/10 text-nu-muted">
                <tr>
                  <th className="text-left px-3 py-1.5 font-mono-nu text-[10px] uppercase tracking-widest">그룹</th>
                  <th className="text-right px-3 py-1.5 font-mono-nu text-[10px] uppercase tracking-widest">파일</th>
                  <th className="text-right px-3 py-1.5 font-mono-nu text-[10px] uppercase tracking-widest">합계</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nu-ink/10">
                {data.groups.slice(0, 10).map((g) => (
                  <tr key={g.id}>
                    <td className="px-3 py-1.5 truncate max-w-[280px]" title={g.name}>{g.name}</td>
                    <td className="px-3 py-1.5 text-right font-mono-nu">{g.count}</td>
                    <td className="px-3 py-1.5 text-right font-mono-nu text-nu-ink font-bold">{fmtBytes(g.bytes)}</td>
                  </tr>
                ))}
                {data.groups.length === 0 && (
                  <tr><td colSpan={3} className="px-3 py-3 text-center text-nu-muted">데이터 없음</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 프로젝트 랭킹 */}
          <div className="border-2 border-nu-ink/10">
            <div className="px-4 py-2 bg-nu-cream/30 border-b-2 border-nu-ink/10">
              <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink font-bold">프로젝트(볼트) R2 자료 TOP 10</span>
            </div>
            <table className="w-full text-[12px]">
              <thead className="bg-nu-cream/10 text-nu-muted">
                <tr>
                  <th className="text-left px-3 py-1.5 font-mono-nu text-[10px] uppercase tracking-widest">볼트</th>
                  <th className="text-right px-3 py-1.5 font-mono-nu text-[10px] uppercase tracking-widest">파일 수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nu-ink/10">
                {data.projects.slice(0, 10).map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-1.5 truncate max-w-[280px]" title={p.title}>{p.title}</td>
                    <td className="px-3 py-1.5 text-right font-mono-nu">{p.count}</td>
                  </tr>
                ))}
                {data.projects.length === 0 && (
                  <tr><td colSpan={2} className="px-3 py-3 text-center text-nu-muted">데이터 없음</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Drive 사본 cleanup */}
          <div className="border-2 border-nu-ink p-4 bg-nu-cream/10">
            <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink font-bold mb-2">방치 Drive 사본 정리</div>
            <p className="text-[12px] text-nu-muted mb-3">
              지정한 일수보다 오래 동기화되지 않은 사본을 휴지통 처리하고 매핑 row 도 정리합니다.
              사용자 OAuth 토큰이 만료된 경우 Drive 휴지통은 건너뛰고 DB row 만 지워요.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted">기준 일수</label>
              <input
                type="number"
                min={7}
                value={cleanupDays}
                onChange={(e) => setCleanupDays(Math.max(7, Number(e.target.value) || 7))}
                className="w-20 px-2 py-1 border-[2px] border-nu-ink/15 text-[12px] font-mono-nu"
              />
              <button
                onClick={() => cleanup(true)}
                disabled={cleanupBusy}
                className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink/30 text-nu-ink hover:border-nu-ink transition-all disabled:opacity-50"
              >
                미리보기 (Dry-run)
              </button>
              <button
                onClick={() => cleanup(false)}
                disabled={cleanupBusy}
                className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-2 border-red-400 bg-red-500 text-white hover:bg-red-600 transition-all flex items-center gap-1.5 disabled:opacity-60"
              >
                {cleanupBusy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                실행
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: "yellow" | "red" }) {
  const ringClass =
    accent === "yellow" ? "border-yellow-400 bg-yellow-50" :
    accent === "red" ? "border-red-400 bg-red-50" :
    "border-nu-ink/10 bg-nu-cream/10";
  return (
    <div className={`border-2 ${ringClass} p-3`}>
      <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">{label}</div>
      <div className="text-[16px] font-bold text-nu-ink">{value}</div>
    </div>
  );
}
