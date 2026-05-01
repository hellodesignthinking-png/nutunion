"use client";

import { useEffect, useState } from "react";
import { X, BarChart3, Loader2, FileText, Layers, Share2, Activity } from "lucide-react";

interface Analytics {
  totals: { pages: number; blocks: number; shared: number; activities_30d: number };
  daily: Array<{ date: string; count: number }>;
  top_contributors: Array<{ actor_id: string; nickname: string; count: number }>;
  top_pages: Array<{ id: string; title: string; icon: string; count: number }>;
  actions: Array<{ action: string; count: number }>;
  window_days: number;
}

interface Props {
  open: boolean;
  ownerType: "nut" | "bolt";
  ownerId: string;
  onClose: () => void;
  onJumpToPage: (pageId: string) => void;
}

export function AnalyticsPanel({ open, ownerType, ownerId, onClose, onJumpToPage }: Props) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/spaces/${ownerType}/${ownerId}/analytics`)
      .then((r) => r.json())
      .then((j) => setData(j))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open, ownerType, ownerId]);

  if (!open) return null;
  const maxDaily = data?.daily.reduce((m, d) => Math.max(m, d.count), 0) ?? 1;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-nu-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-nu-paper border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b-[3px] border-nu-ink bg-white flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink">
            <BarChart3 size={11} /> 분석 · 최근 30일
          </div>
          <button onClick={onClose} className="p-1 text-nu-muted hover:text-nu-ink"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {loading || !data ? (
            <div className="flex items-center gap-1.5 text-[12px] text-nu-muted">
              <Loader2 size={11} className="animate-spin" /> 집계 중…
            </div>
          ) : (
            <>
              {/* Totals */}
              <div className="grid grid-cols-4 gap-2">
                <Stat icon={<FileText size={14} />} label="페이지" value={data.totals.pages} />
                <Stat icon={<Layers size={14} />} label="블록" value={data.totals.blocks} />
                <Stat icon={<Share2 size={14} />} label="공유 중" value={data.totals.shared} />
                <Stat icon={<Activity size={14} />} label="30일 활동" value={data.totals.activities_30d} />
              </div>

              {/* Daily chart */}
              <div>
                <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1.5">
                  일별 활동
                </div>
                {data.daily.length === 0 ? (
                  <div className="text-[11px] text-nu-muted italic">활동 없음</div>
                ) : (
                  <div className="flex items-end gap-0.5 h-20 border-b-[2px] border-nu-ink/15">
                    {data.daily.map((d) => {
                      const h = Math.max(2, Math.round((d.count / maxDaily) * 80));
                      return (
                        <div
                          key={d.date}
                          className="flex-1 bg-nu-pink hover:bg-nu-pink/80"
                          style={{ height: `${h}px` }}
                          title={`${d.date} · ${d.count}건`}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Top contributors */}
              {data.top_contributors.length > 0 && (
                <div>
                  <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1.5">
                    Top 기여자
                  </div>
                  <ul className="space-y-1">
                    {data.top_contributors.map((c) => (
                      <li key={c.actor_id} className="flex items-center gap-2">
                        <span className="font-mono-nu text-[9px] uppercase tracking-widest bg-nu-pink text-white px-1.5 py-0.5">
                          {c.count}
                        </span>
                        <span className="text-[12px] text-nu-ink">{c.nickname}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Top pages */}
              {data.top_pages.length > 0 && (
                <div>
                  <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1.5">
                    가장 활발한 페이지
                  </div>
                  <ul className="space-y-1">
                    {data.top_pages.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => { onJumpToPage(p.id); onClose(); }}
                          className="w-full text-left flex items-center gap-2 px-2 py-1 hover:bg-nu-cream border-[2px] border-nu-ink/15 hover:border-nu-ink"
                        >
                          <span className="text-[14px]">{p.icon}</span>
                          <span className="flex-1 text-[12px] truncate">{p.title}</span>
                          <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">
                            {p.count}회
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action 분포 */}
              {data.actions.length > 0 && (
                <div>
                  <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1.5">
                    액션 분포
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {data.actions.map((a) => (
                      <span
                        key={a.action}
                        className="font-mono-nu text-[9px] uppercase tracking-widest bg-white border border-nu-ink/20 px-1.5 py-0.5"
                      >
                        {a.action}: {a.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white border-[2px] border-nu-ink px-2 py-2 text-center">
      <div className="flex items-center justify-center gap-1 text-nu-pink">{icon}</div>
      <div className="text-[18px] font-extrabold text-nu-ink mt-0.5">{value}</div>
      <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">{label}</div>
    </div>
  );
}
