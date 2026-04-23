"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";

interface Check {
  id: string;
  label: string;
  status: "applied" | "missing" | "error";
  hint?: string;
  detail?: string;
}

interface HealthResponse {
  ok: boolean;
  summary: { total: number; applied: number; missing: number; errors: number };
  checks: Check[];
}

export function HealthClient() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/health/migrations", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "health check 실패");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading && !data) {
    return (
      <div className="border-[2.5px] border-nu-ink bg-nu-paper p-8 text-center font-mono-nu text-[12px] text-nu-graphite">
        <Loader2 size={18} className="animate-spin text-nu-pink mx-auto mb-2" />
        상태 확인 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-[2.5px] border-red-600 bg-red-50 p-6">
        <div className="font-mono-nu text-[11px] uppercase tracking-widest text-red-700 mb-1">오류</div>
        <p className="text-[13px] text-red-700">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      {/* 요약 */}
      <section className={`border-[2.5px] ${data.ok ? "border-green-600 bg-green-50" : "border-orange-500 bg-orange-50"} p-4 mb-4`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {data.ok ? (
              <>
                <CheckCircle2 size={18} className="text-green-700" />
                <span className="font-bold text-[14px] text-green-700">모든 마이그레이션 적용 완료</span>
              </>
            ) : (
              <>
                <AlertTriangle size={18} className="text-orange-700" />
                <span className="font-bold text-[14px] text-orange-700">
                  누락 {data.summary.missing}건 · 오류 {data.summary.errors}건
                </span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="h-9 px-3 border-[2px] border-nu-ink bg-nu-paper text-nu-ink font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink hover:text-nu-paper disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            다시 체크
          </button>
        </div>
        <div className="font-mono-nu text-[10px] text-nu-graphite mt-2">
          적용 {data.summary.applied} / 총 {data.summary.total}
        </div>
      </section>

      {/* 체크 리스트 */}
      <section className="border-[2.5px] border-nu-ink bg-nu-paper">
        <ul className="divide-y divide-nu-ink/10 list-none m-0 p-0">
          {data.checks.map((c) => (
            <li key={c.id} className="p-3 flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                {c.status === "applied" ? (
                  <CheckCircle2 size={16} className="text-green-700" />
                ) : c.status === "missing" ? (
                  <XCircle size={16} className="text-red-600" />
                ) : (
                  <AlertTriangle size={16} className="text-orange-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-[13px] text-nu-ink">{c.label}</span>
                  <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite">
                    {c.id}
                  </span>
                </div>
                {c.hint && (
                  <div className="font-mono-nu text-[11px] text-orange-700 mt-1">
                    💡 {c.hint}
                  </div>
                )}
                {c.detail && (
                  <div className="font-mono-nu text-[10px] text-nu-graphite mt-0.5">
                    {c.detail}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 다운로드/실행 안내 */}
      {data.summary.missing > 0 && (
        <section className="mt-4 border-[2px] border-dashed border-nu-ink/40 bg-nu-cream/20 p-4">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-2">
            📋 마이그레이션 실행 가이드
          </div>
          <ol className="text-[12px] text-nu-graphite space-y-1 leading-relaxed list-decimal pl-5">
            <li>Supabase 대시보드 → SQL Editor 접속</li>
            <li>프로젝트 저장소의 <code className="bg-nu-ink/5 px-1 py-0.5 border border-nu-ink/10">supabase/migrations/</code> 폴더에서 누락된 SQL 파일 내용 복사</li>
            <li>SQL Editor 에 붙여넣고 <kbd className="border border-nu-ink/20 px-1.5 py-0.5 font-mono-nu text-[10px] bg-white">Run</kbd> 클릭</li>
            <li>이 페이지 <strong>다시 체크</strong> 버튼으로 확인</li>
          </ol>
          <div className="mt-3 text-[11px] text-nu-graphite">
            모든 마이그레이션은 <code>IF NOT EXISTS</code> / <code>drop policy if exists</code> 로 멱등성 보장 → 재실행 안전.
          </div>
        </section>
      )}
    </>
  );
}
