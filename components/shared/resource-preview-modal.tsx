"use client";

import { useEffect, useState } from "react";
import { X, ExternalLink, Maximize2, Loader2, AlertCircle } from "lucide-react";

interface ResourcePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  name: string;
}

export function ResourcePreviewModal({ isOpen, onClose, url, name }: ResourcePreviewModalProps) {
  const [embedUrl, setEmbedUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [isNotion, setIsNotion] = useState(false);

  useEffect(() => {
    if (!url) return;

    let targetUrl = url;
    setIsNotion(url.includes("notion.so"));

    // Google Docs / Slides
    if (url.includes("docs.google.com/document") || url.includes("docs.google.com/presentation")) {
      targetUrl = url.replace(/\/edit.*$/, "/preview");
    }
    // Google Sheets
    else if (url.includes("docs.google.com/spreadsheets")) {
      if (url.includes("?")) {
        targetUrl = url.replace(/\/edit.*$/, "/preview?widget=true&headers=false");
      } else {
        targetUrl = url.replace(/\/edit.*$/, "/preview") + "?widget=true&headers=false";
      }
    }
    // Google Drive Files (PDF, Image, Video)
    else if (url.includes("drive.google.com/file/d/")) {
      targetUrl = url.replace(/\/view.*$/, "/preview");
    }

    setEmbedUrl(targetUrl);
    setLoading(true);
  }, [url]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-nu-ink/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="relative w-full h-full max-w-6xl bg-nu-paper border-2 border-nu-ink shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-nu-ink bg-nu-cream/30">
          <div className="flex-1 min-w-0 pr-4">
            <h3 className="font-head text-lg font-extrabold text-nu-ink truncate">{name}</h3>
            <p className="font-mono-nu text-[10px] text-nu-muted truncate uppercase tracking-widest">{url}</p>
          </div>
          
          <div className="flex items-center gap-3">
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-4 py-2 border-[2px] border-nu-ink text-nu-ink no-underline hover:bg-nu-ink hover:text-nu-paper transition-all flex items-center gap-2"
            >
              <ExternalLink size={14} /> <span className="hidden sm:inline">원본 보기</span>
            </a>
            <button 
              onClick={onClose}
              className="p-2 text-nu-muted hover:text-nu-ink transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Iframe View */}
        <div className="flex-1 bg-nu-white relative">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-nu-white z-10">
              <Loader2 size={32} className="text-nu-pink animate-spin mb-4" />
              <p className="font-mono-nu text-xs text-nu-muted uppercase tracking-[0.2em] animate-pulse">
                Initializing Secure Viewer...
              </p>
            </div>
          )}
          
          <iframe 
            src={embedUrl}
            className="w-full h-full border-0"
            onLoad={() => setLoading(false)}
            allow="autoplay; encrypted-media; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />

          {/* Notion Alert Overlay (Since many Notion pages block framing) */}
          {isNotion && !loading && (
            <div className="absolute bottom-6 left-6 right-6 bg-nu-pink/5 border border-nu-pink/20 p-4 rounded backdrop-blur-md flex items-start gap-3 pointer-events-none">
              <AlertCircle size={18} className="text-nu-pink shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-nu-ink">노션 임베드 안내</p>
                <p className="text-[11px] text-nu-graphite leading-relaxed mt-1">
                  노션 페이지가 보이지 않는다면 해당 페이지의 <b>[Share] - [Publish to web]</b> 설정이 활성화되어 있는지 확인해 주세요. 
                  보안 정책으로 차단된 경우 상단의 '원본 보기' 버튼을 이용해 주세요.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-2 border-t border-nu-ink/5 bg-nu-cream/10 flex items-center justify-between">
          <span className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest">
            {isNotion ? "Notion Workspaces" : url.includes("google.com") ? "Google Workspace Integration" : "In-App Private Viewer"}
          </span>
          <div className="flex items-center gap-4">
             <span className="flex items-center gap-1.5 font-mono-nu text-[9px] text-nu-muted">
               <Maximize2 size={10} /> 정식 임베드 모드 활성
             </span>
          </div>
        </div>
      </div>
    </div>
  );
}
