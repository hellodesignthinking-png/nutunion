"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

/** 작은 유틸 */
function cn(...xs: (string | false | undefined | null)[]) { return xs.filter(Boolean).join(" "); }

/* ──────────────────────────────────────────────
   GroupHeader (Reader)
   ────────────────────────────────────────────── */
interface GroupHeaderProps {
  name: string;
  description?: string | null;
  category?: string | null;
  hostNickname?: string | null;
  memberCount?: number;
  kicker?: string;
}
export function GroupReaderHeader({ name, description, category, hostNickname, memberCount, kicker }: GroupHeaderProps) {
  return (
    <header className="mb-8 pb-6 border-b border-[color:var(--reader-border)]">
      {(kicker || category) && (
        <p className="reader-meta mb-2">{kicker ?? category}</p>
      )}
      <h1 className="reader-h1 mb-3">{name}</h1>
      {description && (
        <p className="reader-body mb-4 max-w-[680px]">{description}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 reader-meta">
        {hostNickname && <span>호스트 <strong className="text-[color:var(--reader-text)] font-semibold">{hostNickname}</strong></span>}
        {typeof memberCount === "number" && <span>멤버 {memberCount}명</span>}
      </div>
    </header>
  );
}

/* ──────────────────────────────────────────────
   Tabs
   ────────────────────────────────────────────── */
interface TabItem { key: string; label: string; href?: string; count?: number; }
export function GroupReaderTabs({ tabs, active, onChange }: { tabs: TabItem[]; active: string; onChange?: (k: string) => void }) {
  return (
    <nav role="tablist" aria-label="그룹 탭" className="flex gap-1 border-b border-[color:var(--reader-border)] mb-6 overflow-x-auto">
      {tabs.map((t) => {
        const isActive = active === t.key;
        const content = (
          <span className={cn(
            "inline-flex items-center gap-1.5 px-4 py-3 text-[14px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
            isActive ? "text-[color:var(--reader-text)] border-[color:var(--reader-text)]" : "text-[color:var(--reader-text-muted)] border-transparent hover:text-[color:var(--reader-text)]"
          )}>
            {t.label}
            {typeof t.count === "number" && t.count > 0 && (
              <span className={cn("text-[11px] px-1.5 py-0.5 rounded-full tabular-nums",
                isActive ? "bg-[color:var(--reader-text)] text-[color:var(--reader-card)]" : "bg-[color:var(--reader-border-soft)] text-[color:var(--reader-text-muted)]"
              )}>
                {t.count}
              </span>
            )}
          </span>
        );
        return t.href ? (
          <Link key={t.key} href={t.href} role="tab" aria-selected={isActive} className="no-underline">{content}</Link>
        ) : (
          <button key={t.key} role="tab" aria-selected={isActive} onClick={() => onChange?.(t.key)} className="bg-transparent">
            {content}
          </button>
        );
      })}
    </nav>
  );
}

/* ──────────────────────────────────────────────
   PostCard
   ────────────────────────────────────────────── */
interface PostCardProps {
  title: string;
  preview?: string;
  author?: { nickname: string; avatar_url?: string | null };
  timeAgo?: string;
  href?: string;
  commentsCount?: number;
  likesCount?: number;
  cover?: string | null;
}
export function PostReaderCard({ title, preview, author, timeAgo, href, commentsCount, likesCount, cover }: PostCardProps) {
  const body = (
    <article className="reader-card block no-underline">
      <div className="flex items-center gap-2 reader-meta mb-2">
        {author?.avatar_url ? (
          <Image src={author.avatar_url} alt="" width={20} height={20} className="rounded-full w-5 h-5 object-cover" unoptimized />
        ) : author ? (
          <div className="w-5 h-5 rounded-full bg-[color:var(--reader-border-soft)] flex items-center justify-center text-[10px] font-semibold text-[color:var(--reader-text-muted)]">
            {author.nickname.charAt(0).toUpperCase()}
          </div>
        ) : null}
        {author && <span className="text-[color:var(--reader-text)]">{author.nickname}</span>}
        {timeAgo && <><span>·</span><time>{timeAgo}</time></>}
      </div>
      <h2 className="text-[17px] font-semibold leading-[1.4] text-[color:var(--reader-text)] mb-2">{title}</h2>
      {preview && (
        <p className="reader-body line-clamp-2 !text-[14px] !leading-[1.7]">{preview}</p>
      )}
      {cover && (
        <div className="mt-3 aspect-[2/1] rounded-md overflow-hidden bg-[color:var(--reader-border-soft)]">
          <img src={cover} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      {(typeof commentsCount === "number" || typeof likesCount === "number") && (
        <div className="flex gap-4 mt-3 reader-meta">
          {typeof commentsCount === "number" && <span>💬 {commentsCount}</span>}
          {typeof likesCount === "number" && <span>👍 {likesCount}</span>}
        </div>
      )}
    </article>
  );
  return href ? <Link href={href} className="block no-underline text-inherit">{body}</Link> : body;
}

/* ──────────────────────────────────────────────
   MemberListItem
   ────────────────────────────────────────────── */
interface MemberItemProps {
  nickname: string;
  avatarUrl?: string | null;
  role?: string | null;
  stiffness?: number | null;
  profileHref?: string;
  accent?: boolean;
}
export function MemberReaderItem({ nickname, avatarUrl, role, stiffness, profileHref, accent }: MemberItemProps) {
  return (
    <li className="flex items-center gap-3 py-3 border-b border-[color:var(--reader-border-soft)] last:border-0">
      {avatarUrl ? (
        <Image src={avatarUrl} alt="" width={36} height={36} className="w-9 h-9 rounded-full object-cover shrink-0" unoptimized />
      ) : (
        <div className="w-9 h-9 rounded-full bg-[color:var(--reader-border-soft)] flex items-center justify-center text-[14px] font-semibold text-[color:var(--reader-text-muted)] shrink-0">
          {nickname.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium text-[color:var(--reader-text)] truncate">
          {nickname}
          {accent && <span className="ml-1.5 text-[11px] text-[color:var(--reader-accent)]">● 호스트</span>}
        </div>
        <div className="reader-meta truncate">
          {role && <span>{role}</span>}
          {role && typeof stiffness === "number" && <span> · </span>}
          {typeof stiffness === "number" && <span>강성 {stiffness}</span>}
        </div>
      </div>
      {profileHref && (
        <Link href={profileHref} className="reader-link text-[13px] shrink-0 no-underline hover:underline">
          프로필
        </Link>
      )}
    </li>
  );
}

/* ──────────────────────────────────────────────
   EmptyState (Riso 유지 허용)
   ────────────────────────────────────────────── */
export function ReaderEmptyState({ icon, title, description, cta }: { icon?: ReactNode; title: string; description?: string; cta?: ReactNode }) {
  return (
    <div className="reader-card flex flex-col items-center justify-center text-center py-10 px-6">
      {icon && <div className="mb-3 text-3xl opacity-40">{icon}</div>}
      <p className="text-[15px] font-medium text-[color:var(--reader-text)] mb-1">{title}</p>
      {description && <p className="reader-meta mb-4 max-w-sm">{description}</p>}
      {cta}
    </div>
  );
}
