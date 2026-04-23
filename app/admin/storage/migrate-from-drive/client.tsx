"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, CheckCircle2, XCircle, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";

type Table = "file_attachments" | "project_resources" | "chat_messages";

interface Candidate {
  table: Table;
  id: string;
  url: string;
  name: string;
  created_at?: string | null;
  storage_type?: string | null;
  drive_file_id?: string | null;
}

interface Summary {
  total: number;
  r2: number;
  drive: number;
  pending: number;
}

type RowStatus =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; r2_url?: string }
  | { kind: "failed"; error: string };

const TABLE_LABEL: Record<Table, string> = {
  file_attachments: "자료실",
  project_resources: "볼트 리소스",
  chat_messages: "채팅 첨부",
};

export function MigrateFromDriveClient() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Record<string, RowStatus>>({});
  const [batchRunning, setBatchRunning] = useState(false);
  const [detail, setDetail] = useState<Candidate | null>(null);

  const rowKey = (c: Candidate) => `${c.table}:${c.id}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/storage/migrate-from-drive", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "조회 실패");
      setCandidates(json.candidates || []);
      setSummary(json.summary || null);
      setSelected(new Set());
      setStatus({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allKeys = useMemo(() => candidates.map(rowKey), [candidates]);
  const allSelected = allKeys.length > 0 && allKeys.every(k => selected.has(k));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allKeys));
  };

  const migrateRows = async (rows: { table: Table; id: string }[]) => {
    for (const r of rows) {
      setStatus(s => ({ ...s, [`${r.table}:${r.id}`]: { kind: "running" } }));
    }
    try {
      const res = await fetch("/api/admin/storage/migrate-from-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const json = await res.json();
      if (!res.ok) {
        for (const r of rows) {
          setStatus(s => ({ ...s, [`${r.table}:${r.id}`]: { kind: "failed", error: json.error || "요청 실패" } }));
        }
        toast.error(json.error || "이전 실패");
        return;
      }
      for (const result of json.results || []) {
        const k = `${result.table}:${result.row_id}`;
        if (result.status === "ok") {
          setStatus(s => ({ ...s, [k]: { kind: "done", r2_url: result.r2_url } }));
        } else {
          setStatus(s => ({ ...s, [k]: { kind: "failed", error: result.error || "unknown" } }));
        }
      }
      toast.success(`완료: ${json.counts.ok} / 실패: ${json.counts.failed}`);
    } catch (err) {
      for (const r of rows) {
        setStatus(s => ({ ...s, [`${r.table}:${r.id}`]: { kind: "failed", error: String(err) } }));
      }
    }
  };

  const migrateOne = async (c: Candidate) => {
    await migrateRows([{ table: c.table, id: c.id }]);
  };

  const migrateSelected = async () => {
    const rows = candidates
      .filter(c => selected.has(rowKey(c)))
      .map(c => ({ table: c.table, id: c.id }));
    if (rows.length === 0) {
      toast.error("선택된 항목이 없습니다");
      return;
    }
    setBatchRunning(true);
    try {
      // 서버는 10개 단위로 처리 — 넘으면 여러 번 호출
      for (let i = 0; i < rows.length; i += 10) {
        await migrateRows(rows.slice(i, i + 10));
      }
    } finally {
      setBatchRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="border-[3px] border-nu-ink bg-nu-cream p-8 text-center font-mono-nu text-[12px] text-nu-graphite">
        <Loader2 size={18} className="animate-spin text-nu-pink mx-auto mb-2" />
        이전 후보 조회 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-[3px] border-red-600 bg-red-50 p-6">
        <div className="font-mono-nu text-[11px] uppercase tracking-widest text-red-700 mb-1">오류</div>
        <p className="text-[13px] text-red-700">{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-3 h-9 px-3 border-[2px] border-red-700 bg-white font-mono-nu text-[11px] uppercase tracking-widest hover:bg-red-700 hover:text-white"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <>
      {/* 요약 */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="총 파일" value={summary?.total ?? 0} />
        <Stat label="R2" value={summary?.r2 ?? 0} tone="green" />
        <Stat label="Drive" value={summary?.drive ?? 0} tone="amber" />
        <Stat label="이전 대기" value={summary?.pending ?? 0} tone="pink" />
      </section>

      {/* 컨트롤 */}
      <section className="flex flex-wrap items-center gap-2 mb-3">
        <button
          type="button"
          onClick={migrateSelected}
          disabled={batchRunning || selected.size === 0}
          className="h-10 px-4 border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[12px] uppercase tracking-widest hover:bg-nu-ink disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          {batchRunning ? <Loader2 size={13} className="animate-spin" /> : null}
          선택한 항목 일괄 이전 ({selected.size})
        </button>
        <button
          type="button"
          onClick={load}
          disabled={loading || batchRunning}
          className="h-10 px-3 border-[2px] border-nu-ink bg-nu-cream text-nu-ink font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink hover:text-nu-paper disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <RefreshCw size={13} />
          새로고침
        </button>
        <span className="font-mono-nu text-[11px] text-nu-graphite">
          1회 호출당 최대 10건 · Google-native 문서(구글 문서/시트/슬라이드)는 export 가 필요해 건너뜁니다.
        </span>
      </section>

      {/* 목록 */}
      {candidates.length === 0 ? (
        <div className="border-[3px] border-green-600 bg-green-50 p-8 text-center">
          <CheckCircle2 size={28} className="text-green-700 mx-auto mb-2" />
          <p className="font-bold text-green-800">이전할 Drive 파일이 없습니다 🎉</p>
          <p className="text-[12px] text-green-700/80 mt-1">모든 자료가 이미 R2 로 이전되었거나, Drive 링크가 존재하지 않습니다.</p>
        </div>
      ) : (
        <section className="border-[3px] border-nu-ink bg-nu-paper overflow-hidden">
          <div className="px-3 py-2 border-b-[2px] border-nu-ink bg-nu-ink text-nu-paper font-mono-nu text-[11px] uppercase tracking-widest flex items-center justify-between">
            <span>이전 후보 ({candidates.length})</span>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="accent-nu-pink"
              />
              전체 선택
            </label>
          </div>
          <ul className="divide-y divide-nu-ink/10 list-none m-0 p-0">
            {candidates.map((c) => {
              const key = rowKey(c);
              const st = status[key] ?? ({ kind: "idle" } as RowStatus);
              return (
                <li key={key} className="p-3 flex items-start gap-3 text-[12px]">
                  <input
                    type="checkbox"
                    checked={selected.has(key)}
                    onChange={() => toggle(key)}
                    disabled={st.kind === "running" || st.kind === "done"}
                    className="mt-1 accent-nu-pink"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite bg-nu-cream px-1.5 py-0.5 rounded">
                        {TABLE_LABEL[c.table]}
                      </span>
                      <span className="font-bold text-nu-ink truncate">{c.name}</span>
                    </div>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-mono-nu text-[10px] text-nu-graphite hover:text-nu-pink truncate inline-flex items-center gap-1 no-underline"
                    >
                      {c.url.slice(0, 96)}{c.url.length > 96 ? "…" : ""}
                      <ExternalLink size={9} />
                    </a>
                  </div>
                  <StatusBadge status={st} />
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => migrateOne(c)}
                      disabled={st.kind === "running" || st.kind === "done" || batchRunning}
                      className="h-7 px-2 border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[10px] uppercase tracking-widest hover:bg-nu-ink disabled:opacity-50"
                    >
                      R2 로 이전
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetail(c)}
                      className="h-7 px-2 border-[2px] border-nu-ink bg-nu-paper text-nu-ink font-mono-nu text-[10px] uppercase tracking-widest hover:bg-nu-cream inline-flex items-center gap-1"
                    >
                      <Info size={10} /> 세부사항
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Detail modal */}
      {detail && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="border-[3px] border-nu-ink bg-nu-paper max-w-lg w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1">
              {TABLE_LABEL[detail.table]} · {detail.id}
            </div>
            <h3 className="text-[16px] font-bold text-nu-ink mb-3">{detail.name}</h3>
            <dl className="text-[12px] space-y-2">
              <Row k="Drive file ID" v={detail.drive_file_id || "(파싱 실패)"} />
              <Row k="storage_type" v={detail.storage_type || "(null)"} />
              <Row k="현재 URL" v={detail.url} link />
              <Row k="생성일" v={detail.created_at || "-"} />
            </dl>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="h-9 px-3 border-[2px] border-nu-ink bg-nu-cream font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink hover:text-nu-paper"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "green" | "amber" | "pink" }) {
  const ring = tone === "green" ? "border-green-600" : tone === "amber" ? "border-amber-500" : tone === "pink" ? "border-nu-pink" : "border-nu-ink";
  return (
    <div className={`border-[3px] ${ring} bg-nu-paper p-3`}>
      <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite">{label}</div>
      <div className="text-[22px] font-bold tabular-nums text-nu-ink">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: RowStatus }) {
  if (status.kind === "idle") {
    return <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite shrink-0">대기</span>;
  }
  if (status.kind === "running") {
    return (
      <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink inline-flex items-center gap-1 shrink-0">
        <Loader2 size={10} className="animate-spin" /> 이전 중
      </span>
    );
  }
  if (status.kind === "done") {
    return (
      <span className="font-mono-nu text-[10px] uppercase tracking-widest text-green-700 inline-flex items-center gap-1 shrink-0">
        <CheckCircle2 size={11} /> 완료
      </span>
    );
  }
  return (
    <span
      title={status.error}
      className="font-mono-nu text-[10px] uppercase tracking-widest text-red-700 inline-flex items-center gap-1 shrink-0 max-w-[120px] truncate"
    >
      <XCircle size={11} /> 실패
    </span>
  );
}

function Row({ k, v, link = false }: { k: string; v: string; link?: boolean }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <dt className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite">{k}</dt>
      <dd className="font-mono-nu text-[11px] text-nu-ink break-all">
        {link ? <a href={v} target="_blank" rel="noreferrer noopener" className="text-nu-pink no-underline hover:underline">{v}</a> : v}
      </dd>
    </div>
  );
}
