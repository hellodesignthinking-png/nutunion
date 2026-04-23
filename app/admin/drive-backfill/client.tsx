"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Play, CheckCircle, XCircle, ExternalLink } from "lucide-react";

interface ItemResult {
  kind: "group" | "project";
  id: string;
  name: string;
  status: "created" | "skipped" | "failed";
  folderId?: string;
  webViewLink?: string;
  error?: string;
}

interface BackfillResponse {
  processed: number;
  created: number;
  failed: number;
  skipped: number;
  sharedDriveMode: boolean;
  warning?: string | null;
  details: ItemResult[];
}

export function DriveBackfillClient({ initialPending }: { initialPending: number }) {
  const [running, setRunning] = useState(false);
  const [onlyKind, setOnlyKind] = useState<"" | "group" | "project">("");
  const [dryRun, setDryRun] = useState(true);
  const [report, setReport] = useState<BackfillResponse | null>(null);

  async function run() {
    setRunning(true);
    setReport(null);
    try {
      const res = await fetch("/api/admin/drive/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ only: onlyKind || undefined, dry_run: dryRun }),
      });
      const j = (await res.json()) as BackfillResponse & { error?: string; code?: string };
      if (!res.ok) {
        if (j.code === "NOT_CONNECTED") {
          toast.error("Google 계정을 먼저 연결하세요 — Profile > Integrations");
        } else if (j.code === "TOKEN_EXPIRED") {
          toast.error("Google 토큰 만료 — 재연결 필요");
        } else {
          toast.error((j as any).error || "실패");
        }
        return;
      }
      setReport(j);
      if (dryRun) {
        toast.info(`Dry run 완료 — 대상 ${j.processed}건 (실제 생성 X)`);
      } else {
        toast.success(`완료 — 생성 ${j.created} · 실패 ${j.failed}`);
      }
    } catch (e: any) {
      toast.error(e.message || "네트워크 오류");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="border-[2px] border-nu-ink rounded-lg p-5 bg-white space-y-4">
      <h2 className="font-bold text-[15px] text-nu-ink">일괄 생성 실행</h2>

      {/* 옵션 */}
      <div className="space-y-2 text-[13px]">
        <div className="flex items-center gap-2">
          <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted w-20">대상</span>
          <label className="inline-flex items-center gap-1">
            <input type="radio" name="kind" checked={onlyKind === ""} onChange={() => setOnlyKind("")} />
            <span>전체 (너트 + 볼트)</span>
          </label>
          <label className="inline-flex items-center gap-1 ml-3">
            <input type="radio" name="kind" checked={onlyKind === "group"} onChange={() => setOnlyKind("group")} />
            <span>너트만</span>
          </label>
          <label className="inline-flex items-center gap-1 ml-3">
            <input type="radio" name="kind" checked={onlyKind === "project"} onChange={() => setOnlyKind("project")} />
            <span>볼트만</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted w-20">모드</span>
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            <span>
              <strong>Dry run</strong> (실제 생성 없이 대상만 조회)
            </span>
          </label>
        </div>
      </div>

      {/* 실행 버튼 */}
      <div className="flex items-center gap-3 pt-2 border-t border-nu-ink/10">
        <button
          onClick={run}
          disabled={running || initialPending === 0}
          className="inline-flex items-center gap-2 px-4 py-2 bg-nu-pink text-white rounded-full text-[13px] font-bold hover:bg-nu-ink disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {running
            ? "실행 중…"
            : dryRun
              ? "Dry run 실행"
              : `실제 생성 (${initialPending}건)`}
        </button>
        {initialPending === 0 && (
          <span className="text-[12px] text-nu-muted">처리할 대상이 없어요 — 모든 너트/볼트에 이미 폴더가 연결됨</span>
        )}
      </div>

      {/* 결과 */}
      {report && (
        <div className="mt-4 border-t border-nu-ink/10 pt-4 space-y-3">
          <div className="flex items-center gap-3 text-[13px] flex-wrap">
            <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted">결과</span>
            <span>총 {report.processed}건</span>
            <span className="text-green-700 font-bold">생성 {report.created}</span>
            {report.failed > 0 && <span className="text-red-600 font-bold">실패 {report.failed}</span>}
            {report.skipped > 0 && <span className="text-nu-muted">스킵 {report.skipped}</span>}
            <span className="text-nu-muted">
              {report.sharedDriveMode ? "· Shared Drive 모드" : "· 호스트 개인 Drive 모드 ⚠"}
            </span>
          </div>

          {report.warning && (
            <p className="text-[12px] bg-amber-50 border border-amber-200 text-amber-800 p-2 rounded">
              {report.warning}
            </p>
          )}

          <div className="max-h-[400px] overflow-auto border border-nu-ink/10 rounded">
            <table className="w-full text-[12px]">
              <thead className="bg-nu-ink/5 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-mono-nu uppercase tracking-widest text-[10px]">구분</th>
                  <th className="text-left px-3 py-2 font-mono-nu uppercase tracking-widest text-[10px]">이름</th>
                  <th className="text-left px-3 py-2 font-mono-nu uppercase tracking-widest text-[10px]">상태</th>
                  <th className="text-left px-3 py-2 font-mono-nu uppercase tracking-widest text-[10px]">링크/오류</th>
                </tr>
              </thead>
              <tbody>
                {report.details.map((r, i) => (
                  <tr key={i} className="border-t border-nu-ink/5">
                    <td className="px-3 py-1.5 font-mono-nu uppercase text-[10px]">{r.kind === "group" ? "너트" : "볼트"}</td>
                    <td className="px-3 py-1.5 truncate max-w-[220px]">{r.name}</td>
                    <td className="px-3 py-1.5">
                      {r.status === "created" && (
                        <span className="inline-flex items-center gap-1 text-green-700">
                          <CheckCircle size={11} /> 생성
                        </span>
                      )}
                      {r.status === "failed" && (
                        <span className="inline-flex items-center gap-1 text-red-600">
                          <XCircle size={11} /> 실패
                        </span>
                      )}
                      {r.status === "skipped" && <span className="text-nu-muted">스킵</span>}
                    </td>
                    <td className="px-3 py-1.5">
                      {r.webViewLink ? (
                        <a
                          href={r.webViewLink}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex items-center gap-1 text-nu-blue no-underline hover:underline"
                        >
                          열기 <ExternalLink size={9} />
                        </a>
                      ) : r.error ? (
                        <span className="text-red-600 text-[11px]">{r.error}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
