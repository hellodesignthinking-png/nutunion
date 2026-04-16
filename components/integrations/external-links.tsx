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
        {kakaoUrl && (
          <a
            href={kakaoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 text-sm text-nu-graphite no-underline hover:text-[#FEE500] transition-colors py-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0">
              <path d="M12 3C6.48 3 2 6.48 2 10.5c0 2.58 1.68 4.85 4.22 6.13-.14.5-.9 3.23-.93 3.44 0 0-.02.16.08.22.1.06.22.01.22.01.29-.04 3.37-2.2 3.9-2.57.82.12 1.66.18 2.51.18 5.52 0 10-3.48 10-7.5S17.52 3 12 3z" fill="#191919"/>
            </svg>
            <span>카카오톡 오픈채팅</span>
            <ExternalLink size={10} className="text-nu-muted ml-auto" />
          </a>
        )}
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
