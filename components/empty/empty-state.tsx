import Link from "next/link";
import type { ReactNode } from "react";

/**
 * EmptyState — "비어있음이 아니라 아직 시작되지 않은 Scene"
 *
 * Reader Mode 안에서 Hero 감각을 짧게 빌려옴.
 * - Visual: 120~200px · 중앙 정렬 · opacity 0.6~1.0
 * - Title:  18px semibold neutral-900
 * - Desc:   14px neutral-500 max-w-[320px]
 * - CTA:    1~2개 (primary + ghost)
 */

export interface EmptyStateProps {
  visual?: ReactNode;
  kicker?: string;
  title: string;
  description?: string;
  primaryCta?: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
  className?: string;
}

export function EmptyState({
  visual,
  kicker,
  title,
  description,
  primaryCta,
  secondaryCta,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-12 md:py-16 px-6 bg-[color:var(--neutral-0)] border border-[color:var(--neutral-100)] rounded-[var(--ds-radius-xl)] ${className}`}
    >
      {visual && (
        <div className="mb-4 opacity-90" aria-hidden="true">{visual}</div>
      )}
      {kicker && (
        <p className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-[color:var(--liquid-primary)] font-bold mb-2">
          {kicker}
        </p>
      )}
      <p className="text-[18px] font-semibold text-[color:var(--neutral-900)] leading-[1.4] mb-2">
        {title}
      </p>
      {description && (
        <p className="text-[14px] text-[color:var(--neutral-500)] leading-[1.6] max-w-[320px] mb-5">
          {description}
        </p>
      )}
      {(primaryCta || secondaryCta) && (
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {primaryCta && (
            <Link
              href={primaryCta.href}
              className="inline-flex items-center gap-1 px-4 py-2 bg-[color:var(--neutral-900)] text-[color:var(--neutral-0)] rounded-[var(--ds-radius-md)] text-[13px] font-medium no-underline hover:bg-[color:var(--liquid-primary)] transition-colors"
              style={{ transitionDuration: "var(--ds-dur-utility)" }}
            >
              {primaryCta.label} →
            </Link>
          )}
          {secondaryCta && (
            <Link
              href={secondaryCta.href}
              className="inline-flex items-center gap-1 px-4 py-2 border border-[color:var(--neutral-200)] rounded-[var(--ds-radius-md)] text-[13px] font-medium text-[color:var(--neutral-700)] no-underline hover:bg-[color:var(--neutral-50)] transition-colors"
            >
              {secondaryCta.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
   9종 사전 정의 Empty States
   각각 단일 import 로 바로 사용 가능.
   ────────────────────────────────────────────── */

const DotPrism = ({ size = 120 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="60" cy="60" r="50" stroke="var(--neutral-100)" strokeWidth="1.5" strokeDasharray="2 6" />
    <circle cx="60" cy="60" r="30" fill="var(--liquid-primary)" opacity="0.08" />
    <circle cx="60" cy="60" r="4" fill="var(--liquid-primary)" />
  </svg>
);

const EmptyNut = ({ size = 120 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <polygon points="60,20 96,40 96,80 60,100 24,80 24,40" stroke="var(--neutral-300)" strokeWidth="1.5" fill="none" />
    <polygon points="60,40 78,50 78,70 60,80 42,70 42,50" stroke="var(--neutral-200)" strokeWidth="1" fill="var(--neutral-50)" />
    <circle cx="60" cy="60" r="3" fill="var(--neutral-300)" />
  </svg>
);

const EmptyMilestones = ({ size = 120 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    {[20, 100, 180].map((cx, i) => (
      <g key={i}>
        <circle cx={cx} cy="30" r="14" stroke="var(--neutral-200)" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
        {i < 2 && <line x1={cx + 14} y1="30" x2={cx + 66} y2="30" stroke="var(--neutral-100)" strokeWidth="1" strokeDasharray="2 4" />}
      </g>
    ))}
  </svg>
);

const SilentWave = ({ size = 120 }: { size?: number }) => (
  <svg width={size * 1.5} height={size / 2} viewBox="0 0 180 60" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <line x1="0" y1="30" x2="180" y2="30" stroke="var(--neutral-200)" strokeWidth="1" />
    {[30, 60, 90, 120, 150].map((x, i) => (
      <circle key={i} cx={x} cy="30" r="2" fill="var(--neutral-300)" opacity={0.3 + (i % 3) * 0.2} />
    ))}
  </svg>
);

const ZeroRing = ({ size = 120 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="50" cy="50" r="42" stroke="var(--neutral-100)" strokeWidth="8" />
    <text x="50" y="58" textAnchor="middle" fontSize="28" fontWeight="600" fill="var(--neutral-300)" fontFamily="var(--ds-font-sans)">0</text>
  </svg>
);

/* ---- 사전 정의 9종 ---- */

export function EmptyDashboardNewbie({ nickname }: { nickname?: string }) {
  return (
    <EmptyState
      visual={<DotPrism />}
      kicker="First Moment"
      title="첫 Scene이 곧 시작됩니다"
      description={`${nickname ? `${nickname}님, ` : ""}관심 있는 너트 3개를 고르면 Protocol이 연결을 시작해요`}
      primaryCta={{ href: "/groups", label: "관심 너트 둘러보기" }}
      secondaryCta={{ href: "/profile", label: "프로필 완성" }}
    />
  );
}

export function EmptyMyNuts() {
  return (
    <EmptyState
      visual={<EmptyNut />}
      title="아직 너트가 없어요"
      description="같은 관심사의 사람들이 모여 너트를 형성해요. 하나만 들어가도 Feed 가 달라져요."
      primaryCta={{ href: "/groups", label: "너트 둘러보기" }}
      secondaryCta={{ href: "/groups/create", label: "직접 만들기" }}
    />
  );
}

export function EmptyMyBolts() {
  return (
    <EmptyState
      visual={<EmptyMilestones />}
      title="지원한 볼트가 없어요"
      description="볼트에 지원하면 실질적인 프로젝트 경험이 쌓여요"
      primaryCta={{ href: "/projects", label: "진행 중 볼트 보기" }}
    />
  );
}

export function EmptyActivityFeed({ hasNuts = false }: { hasNuts?: boolean }) {
  return (
    <EmptyState
      visual={<SilentWave />}
      title="아직 조용하네요"
      description={hasNuts ? "팀원들의 활동이 여기로 모여요" : "너트에 가입하고 볼트에 참여하면 Feed 가 살아나요"}
      primaryCta={hasNuts ? { href: "/projects", label: "볼트 탐색" } : { href: "/groups", label: "추천 너트 보기" }}
    />
  );
}

export function EmptyStiffness() {
  return (
    <EmptyState
      visual={<ZeroRing />}
      kicker="Stiffness 0"
      title="첫 움직임을 시작해보세요"
      description="강성은 너트 활동·볼트 기여·탭 작성으로 쌓여요"
      primaryCta={{ href: "/stiffness", label: "올리는 방법 3가지" }}
      secondaryCta={{ href: "/projects", label: "추천 볼트" }}
    />
  );
}

export function EmptySearch({ query }: { query: string }) {
  return (
    <EmptyState
      title={`"${query}"에 맞는 결과가 없어요`}
      description="다른 키워드로 시도하거나 새 너트를 만들어보세요"
      primaryCta={{ href: "/groups/create", label: "너트 만들기" }}
      secondaryCta={{ href: "/groups", label: "전체 보기" }}
    />
  );
}

export function EmptyNutPosts() {
  return (
    <EmptyState
      title="첫 게시물을 작성해보세요"
      description="너트장이 첫 글을 쓰면 멤버들이 참여하기 시작해요"
      primaryCta={{ href: "#post-composer", label: "게시물 작성" }}
    />
  );
}

export function EmptyApplications() {
  return (
    <EmptyState
      title="아직 지원자가 없어요"
      description="볼트를 너트에 공유하면 빠르게 모집돼요"
      primaryCta={{ href: "#share", label: "너트에 공유" }}
      secondaryCta={{ href: "#settings", label: "설명 다듬기" }}
    />
  );
}

export function EmptyOffline() {
  return (
    <EmptyState
      title="연결이 잠시 끊어졌어요"
      description="곧 다시 시도할게요"
      primaryCta={{ href: "#", label: "새로고침" }}
    />
  );
}
