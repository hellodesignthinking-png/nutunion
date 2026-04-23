"use client";

import { ExternalLink, MessageCircle, FolderOpen } from "lucide-react";

interface ExternalLinksProps {
  kakaoUrl?: string | null;
  driveUrl?: string | null;
  chatUrl?: string;
  label?: string;
}

export function ExternalLinks({ kakaoUrl, driveUrl, chatUrl, label = "연동" }: ExternalLinksProps) {
  const hasAny = kakaoUrl || driveUrl || chatUrl;
  if (!hasAny) return null;

  return (
    <div className="bg-nu-white border border-nu-ink/[0.06] p-4">
      <span className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted block mb-3">
        {label}
      </span>
      <div className="flex flex-col gap-2">
        {chatUrl && (
          <a
            href={chatUrl}
            className="flex items-center gap-2.5 text-sm text-nu-graphite no-underline hover:text-nu-pink transition-colors py-1"
          >
            <MessageCircle size={14} className="text-nu-pink shrink-0" />
            <span>팀 채팅</span>
            <ExternalLink size={10} className="text-nu-muted ml-auto" />
          </a>
        )}
        {/* 카카오톡 오픈채팅 제거 (2026-04) — 내장 채팅으로 통일 */}
        {driveUrl && (
          <a
            href={driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 text-sm text-nu-graphite no-underline hover:text-nu-blue transition-colors py-1"
          >
            <FolderOpen size={14} className="text-nu-blue shrink-0" />
            <span>Google Drive</span>
            <ExternalLink size={10} className="text-nu-muted ml-auto" />
          </a>
        )}
      </div>
    </div>
  );
}
