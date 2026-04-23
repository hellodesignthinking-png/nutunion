"use client";

/**
 * LeaderPendingBadge — 리더(호스트/볼트 생성자)만 보이는 "처리 대기 N건" 배지.
 *
 * 드롭다운:
 *  - 너트별 가입 신청 수 + 해당 너트로 바로가기
 *  - 볼트별 지원서 수 + 해당 볼트로 바로가기
 *  - 정산 건별 금액 + 해당 맥락 페이지로
 *
 * /api/leader/pending-count — 총 합계만 가볍게 (5분 주기)
 * /api/leader/pending-details — 드롭다운 열 때 상세 로드
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, UserPlus, Briefcase, DollarSign, ChevronRight, MessageSquare } from "lucide-react";

interface PendingCount {
  total: number;
  join_requests: number;
  project_applications: number;
  settlements: number;
}

interface PendingDetails {
  join_requests: Array<{ group_id: string; group_name: string; count: number; url: string }>;
  project_applications: Array<{ project_id: string; project_title: string; count: number; url: string }>;
  settlements: Array<{ settlement_id: string; amount: number; currency: string; url: string; context: string }>;
}

const REFRESH_MS = 5 * 60 * 1000;

export function LeaderPendingBadge() {
  const [counts, setCounts] = useState<PendingCount | null>(null);
  const [details, setDetails] = useState<PendingDetails | null>(null);
  const [open, setOpen] = useState(false);

  const loadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/leader/pending-count", { cache: "no-store" });
      if (!res.ok) return;
      setCounts(await res.json());
    } catch {}
  }, []);

  const loadDetails = useCallback(async () => {
    try {
      const res = await fetch("/api/leader/pending-details", { cache: "no-store" });
      if (!res.ok) return;
      setDetails(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    loadCount();
    const i = window.setInterval(loadCount, REFRESH_MS);
    const onFocus = () => loadCount();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(i);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadCount]);

  useEffect(() => {
    if (open && !details) loadDetails();
  }, [open, details, loadDetails]);

  if (!counts || counts.total === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-nu-pink/10 border border-nu-pink/30 text-nu-pink hover:bg-nu-pink/20 transition-colors"
        aria-label={`처리 대기 ${counts.total}건`}
        title={`처리 대기 ${counts.total}건`}
      >
        <Inbox size={14} />
        <span className="font-mono-nu text-[11px] font-bold tabular-nums">
          {counts.total > 99 ? "99+" : counts.total}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-40 w-[320px] bg-white border border-nu-ink/15 rounded-xl shadow-lg p-1 chat-system-font max-h-[70vh] overflow-auto">
            <div className="px-3 py-2 border-b border-nu-ink/5">
              <div className="text-[10px] font-mono-nu text-nu-muted uppercase tracking-widest">리더 처리 대기</div>
              <div className="text-[14px] font-bold text-nu-ink">{counts.total}건</div>
            </div>

            {details === null && (
              <div className="px-3 py-6 text-center text-[12px] text-nu-muted">불러오는 중…</div>
            )}

            {details && (
              <>
                {/* 너트 가입 신청 */}
                {details.join_requests.length > 0 && (
                  <Section icon={<UserPlus size={13} className="text-nu-pink" />} label="가입 신청">
                    {details.join_requests.map((g) => (
                      <DetailRow
                        key={g.group_id}
                        title={g.group_name}
                        subtitle="너트"
                        count={g.count}
                        href={g.url}
                        chatTargetGroup={g.group_id}
                        onClose={() => setOpen(false)}
                      />
                    ))}
                  </Section>
                )}

                {/* 볼트 지원서 */}
                {details.project_applications.length > 0 && (
                  <Section icon={<Briefcase size={13} className="text-nu-blue" />} label="볼트 지원서">
                    {details.project_applications.map((p) => (
                      <DetailRow
                        key={p.project_id}
                        title={p.project_title}
                        subtitle="볼트"
                        count={p.count}
                        href={p.url}
                        chatTargetProject={p.project_id}
                        onClose={() => setOpen(false)}
                      />
                    ))}
                  </Section>
                )}

                {/* 정산 */}
                {details.settlements.length > 0 && (
                  <Section icon={<DollarSign size={13} className="text-[#22C55E]" />} label="정산 승인">
                    {details.settlements.map((s) => {
                      // settlement url 에서 맥락 추출 (groups/{id}/finance 또는 projects/{id})
                      const groupMatch = s.url.match(/\/groups\/([^/]+)/);
                      const projectMatch = s.url.match(/\/projects\/([^/]+)/);
                      return (
                        <DetailRow
                          key={s.settlement_id}
                          title={`${s.amount.toLocaleString()} ${s.currency}`}
                          subtitle={s.context}
                          count={1}
                          href={s.url}
                          chatTargetGroup={groupMatch?.[1]}
                          chatTargetProject={projectMatch?.[1]}
                          onClose={() => setOpen(false)}
                        />
                      );
                    })}
                  </Section>
                )}

                {details.join_requests.length === 0 &&
                  details.project_applications.length === 0 &&
                  details.settlements.length === 0 && (
                    <div className="px-3 py-4 text-center text-[12px] text-nu-muted">
                      처리할 항목이 없어요
                    </div>
                  )}
              </>
            )}

            <div className="px-3 py-1.5 mt-1 border-t border-nu-ink/5 text-[10px] text-nu-muted">
              각 너트/볼트 채팅방에서 바로 승인할 수도 있어요
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Section({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-1">
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono-nu text-nu-graphite uppercase tracking-widest font-bold">
        {icon} {label}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function DetailRow({
  title,
  subtitle,
  count,
  href,
  chatTargetGroup,
  chatTargetProject,
  onClose,
}: {
  title: string;
  subtitle: string;
  count: number;
  href: string;
  chatTargetGroup?: string;
  chatTargetProject?: string;
  onClose: () => void;
}) {
  function openChatDock(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // 1) 같은 페이지에 dock panel 이 있으면 custom event 로 즉시 open
    window.dispatchEvent(
      new CustomEvent("nu:open-chat-dock", {
        detail: {
          group_id: chatTargetGroup,
          project_id: chatTargetProject,
        },
      }),
    );
    // 2) 목적지 페이지에 dock panel 이 있을 확률 높음 — ?openChat=1 파라미터로 이동
    const sep = href.includes("?") ? "&" : "?";
    window.location.href = href + sep + "openChat=1";
    onClose();
  }

  return (
    <div className="flex items-stretch gap-1 px-1 py-0.5 rounded-lg hover:bg-nu-ink/5">
      <Link
        href={href}
        onClick={onClose}
        className="flex-1 flex items-center gap-2 px-2 py-2 rounded-lg no-underline"
      >
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-nu-ink truncate">{title}</div>
          <div className="text-[10px] font-mono-nu text-nu-muted uppercase tracking-widest">{subtitle}</div>
        </div>
        {count > 0 && (
          <span className="font-mono-nu text-[11px] font-bold tabular-nums text-nu-pink">{count}</span>
        )}
        <ChevronRight size={12} className="text-nu-muted" />
      </Link>
      {(chatTargetGroup || chatTargetProject) && (
        <button
          onClick={openChatDock}
          className="shrink-0 px-2 rounded-lg hover:bg-nu-pink/10 text-nu-pink"
          title="채팅방 바로 열기"
          aria-label="채팅방 바로 열기"
        >
          <MessageSquare size={13} />
        </button>
      )}
    </div>
  );
}
