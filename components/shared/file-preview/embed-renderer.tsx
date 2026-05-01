"use client";

import { ExternalLink } from "lucide-react";
import type { FileKind } from "@/lib/file-preview/detect-kind";
import { toGdriveEmbed, toYoutubeEmbed } from "@/lib/file-preview/detect-kind";
import { ExternalCard } from "./external-card";

interface OgMeta {
  title?: string;
  description?: string;
  image?: string;
  site_name?: string;
}

interface Props {
  kind: FileKind;
  url: string;
  name: string;
  og?: OgMeta | null;
  ogLoading?: boolean;
}

/**
 * file-preview-panel 의 third-party 임베드 분기 (~310 LoC) 를 분리한 디스패처.
 *
 * 지원 kind: youtube / gdrive / vimeo / loom / figma / tweet / spotify / soundcloud /
 *           gist / codepen / tiktok / instagram / miro / slideshare / notion / github / other
 *
 * 미지원 kind 는 null 을 반환 — panel 이 자체 분기 (pdf, image, video, audio, text, office,
 * hwp, html) 를 그대로 처리.
 */
export function EmbedRenderer({ kind, url, name, og = null, ogLoading = false }: Props): React.ReactElement | null {
  switch (kind) {
    case "youtube": {
      const embed = toYoutubeEmbed(url);
      if (embed) {
        return (
          <div className="w-full h-full flex items-center justify-center bg-black">
            <iframe
              src={embed}
              title={name}
              className="w-full h-full border-0"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        );
      }
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 gap-4 text-center bg-nu-cream/20">
          <div className="w-20 h-20 border-[3px] border-nu-ink bg-nu-paper flex items-center justify-center text-3xl">▶️</div>
          <div>
            <p className="text-sm font-bold text-nu-ink mb-1">YouTube 채널 / 플레이리스트</p>
            <p className="text-[12px] text-nu-muted max-w-md break-all">
              이 URL 은 YouTube 정책상 사이트 내 미리보기를 차단합니다 (X-Frame-Options).
            </p>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-2 border-[2px] border-nu-ink bg-nu-ink text-nu-paper no-underline hover:bg-nu-pink transition-all flex items-center gap-2"
          >
            <ExternalLink size={13} /> YouTube 에서 열기
          </a>
        </div>
      );
    }

    case "gdrive": {
      const embed = toGdriveEmbed(url);
      if (embed) {
        return (
          <div className="w-full h-full flex flex-col">
            <iframe
              src={embed}
              title={name}
              className="w-full flex-1 border-0"
              allow="autoplay"
            />
            <div className="border-t-[2px] border-nu-ink bg-nu-cream/30 px-3 py-2 flex items-center justify-between gap-2">
              <p className="text-[11px] text-nu-muted">Google Drive 미리보기 — 편집은 새 탭에서</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink bg-nu-ink text-nu-paper no-underline hover:bg-nu-pink transition-all flex items-center gap-1.5"
              >
                <ExternalLink size={12} /> Drive 에서 편집
              </a>
            </div>
          </div>
        );
      }
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 gap-4 text-center">
          <div className="w-20 h-20 border-[3px] border-nu-ink bg-nu-cream/40 flex items-center justify-center text-3xl">📁</div>
          <p className="text-sm font-bold text-nu-ink">Google Drive 파일</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-2 border-[2px] border-nu-ink bg-nu-ink text-nu-paper no-underline hover:bg-nu-pink transition-all flex items-center gap-2"
          >
            <ExternalLink size={13} /> Drive 에서 열기
          </a>
        </div>
      );
    }

    case "vimeo": {
      const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/) || url.match(/player\.vimeo\.com\/video\/(\d+)/);
      if (!m) return <ExternalCard url={url} name={name} icon="🎬" label="Vimeo" />;
      return (
        <div className="w-full h-full flex items-center justify-center bg-black">
          <iframe
            src={`https://player.vimeo.com/video/${m[1]}`}
            title={name}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }

    case "loom": {
      const m = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
      if (!m) return <ExternalCard url={url} name={name} icon="📹" label="Loom" />;
      return (
        <div className="w-full h-full flex items-center justify-center bg-black">
          <iframe
            src={`https://www.loom.com/embed/${m[1]}`}
            title={name}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        </div>
      );
    }

    case "figma":
      return (
        <div className="w-full h-full flex flex-col">
          <iframe
            src={`https://www.figma.com/embed?embed_host=nutunion&url=${encodeURIComponent(url)}`}
            title={name}
            className="w-full flex-1 border-0"
            allow="fullscreen"
            allowFullScreen
          />
          <div className="border-t-[2px] border-nu-ink bg-nu-cream/30 px-3 py-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-nu-muted">Figma 미리보기 — 편집은 새 탭에서</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink bg-nu-ink text-nu-paper no-underline hover:bg-nu-pink transition-all flex items-center gap-1.5"
            >
              <ExternalLink size={12} /> Figma 에서 열기
            </a>
          </div>
        </div>
      );

    case "tweet":
      return (
        <div className="w-full h-full flex flex-col bg-nu-cream/20">
          <iframe
            src={`https://twitframe.com/show?url=${encodeURIComponent(url)}`}
            title={name}
            className="w-full flex-1 border-0"
            sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
          />
          <div className="border-t-[2px] border-nu-ink bg-nu-paper px-3 py-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-nu-muted">트윗 미리보기 (twitframe)</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink bg-nu-ink text-nu-paper no-underline hover:bg-nu-pink transition-all flex items-center gap-1.5"
            >
              <ExternalLink size={12} /> X 에서 열기
            </a>
          </div>
        </div>
      );

    case "spotify": {
      const m = url.match(/open\.spotify\.com\/(?:embed\/)?(track|album|playlist|episode|show|artist)\/([a-zA-Z0-9]+)/);
      if (!m) return <ExternalCard url={url} name={name} icon="🎵" label="Spotify" />;
      const isTrack = m[1] === "track" || m[1] === "episode";
      return (
        <div className={`w-full h-full ${isTrack ? "flex items-center justify-center p-4 bg-nu-cream/20" : ""}`}>
          <iframe
            src={`https://open.spotify.com/embed/${m[1]}/${m[2]}`}
            title={name}
            className={isTrack ? "w-full max-w-2xl border-0" : "w-full h-full border-0"}
            style={isTrack ? { height: 232 } : undefined}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        </div>
      );
    }

    case "soundcloud":
      return (
        <div className="w-full h-full p-4 bg-nu-cream/20 flex items-center justify-center">
          <iframe
            src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`}
            title={name}
            className="w-full max-w-3xl border-0"
            style={{ height: 166 }}
            allow="autoplay"
            loading="lazy"
          />
        </div>
      );

    case "gist": {
      const m = url.match(/gist\.github\.com\/([^/]+)\/([\w]+)/);
      if (!m) return <ExternalCard url={url} name={name} icon="📝" label="GitHub Gist" og={og} ogLoading={ogLoading} />;
      const rawUrl = `https://gist.githubusercontent.com/${m[1]}/${m[2]}/raw`;
      return (
        <div className="w-full h-full flex flex-col">
          <iframe
            src={`https://gist.github.com/${m[1]}/${m[2]}.pibb`}
            title={name}
            className="w-full flex-1 border-0 bg-white"
            sandbox="allow-scripts allow-same-origin"
            loading="lazy"
          />
          <div className="border-t-[2px] border-nu-ink bg-nu-cream/30 px-3 py-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-nu-muted">GitHub Gist · 코드 임베드</p>
            <a
              href={rawUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink bg-nu-paper hover:bg-nu-ink hover:text-nu-paper transition-all flex items-center gap-1.5"
            >
              <ExternalLink size={12} /> Raw 보기
            </a>
          </div>
        </div>
      );
    }

    case "codepen": {
      const m = url.match(/codepen\.io\/([^/]+)\/(?:pen|embed)\/([^/?#]+)/);
      if (!m) return <ExternalCard url={url} name={name} icon="✨" label="CodePen" og={og} ogLoading={ogLoading} />;
      return (
        <iframe
          src={`https://codepen.io/${m[1]}/embed/${m[2]}?default-tab=result&theme-id=light`}
          title={name}
          className="w-full h-full border-0"
          allowFullScreen
          loading="lazy"
        />
      );
    }

    case "tiktok": {
      const m = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/) || url.match(/tiktok\.com\/v\/(\d+)/);
      if (!m) return <ExternalCard url={url} name={name} icon="🎬" label="TikTok" og={og} ogLoading={ogLoading} />;
      return (
        <div className="w-full h-full flex items-center justify-center bg-black p-4">
          <iframe
            src={`https://www.tiktok.com/embed/v2/${m[1]}`}
            title={name}
            className="w-full max-w-md h-full border-0"
            allow="encrypted-media; fullscreen"
            loading="lazy"
          />
        </div>
      );
    }

    case "instagram": {
      const m = url.match(/instagram\.com\/(p|reel|tv)\/([^/?#]+)/);
      if (!m) return <ExternalCard url={url} name={name} icon="📸" label="Instagram" og={og} ogLoading={ogLoading} />;
      return (
        <div className="w-full h-full flex items-center justify-center bg-nu-cream/20 p-4 overflow-y-auto">
          <iframe
            src={`https://www.instagram.com/${m[1]}/${m[2]}/embed/captioned/`}
            title={name}
            className="w-full max-w-md border-0 bg-white"
            style={{ height: 700 }}
            scrolling="no"
            loading="lazy"
          />
        </div>
      );
    }

    case "miro": {
      const m = url.match(/miro\.com\/app\/board\/([^/?#=]+)/);
      if (!m) return <ExternalCard url={url} name={name} icon="🧩" label="Miro" og={og} ogLoading={ogLoading} />;
      return (
        <iframe
          src={`https://miro.com/app/live-embed/${m[1]}/?embedMode=view_only_without_ui`}
          title={name}
          className="w-full h-full border-0"
          allow="fullscreen; clipboard-read; clipboard-write"
          loading="lazy"
        />
      );
    }

    case "slideshare":
      // SlideShare 는 oEmbed 가 필요해서 정확한 embed URL 추출이 어려움 → OG 카드 + 새 탭 열기로 폴백.
      return (
        <div className="w-full h-full">
          <ExternalCard url={url} name={name} icon="🖼️" label="SlideShare" og={og} ogLoading={ogLoading} />
        </div>
      );

    case "notion":
    case "github":
      return (
        <ExternalCard
          url={url}
          name={name}
          icon={kind === "notion" ? "📓" : "🐙"}
          label={kind === "notion" ? "Notion" : "GitHub"}
          og={og}
          ogLoading={ogLoading}
          note={kind === "notion"
            ? "Notion 페이지는 보안 정책상 임베드 미리보기를 차단합니다"
            : "GitHub 페이지는 임베드를 차단합니다"}
        />
      );

    default:
      // pdf / image / video / audio / text / office / hwp / html / other → panel 이 직접 처리
      return null;
  }
}
