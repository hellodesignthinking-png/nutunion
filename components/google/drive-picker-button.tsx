"use client";

/**
 * DrivePickerButton — Google Drive 파일 선택 + 자동 권한 변경 + DB 등록.
 *
 * 동작:
 *  1) gapi.load("picker") + google.accounts.oauth2 토큰 획득
 *  2) Picker UI 띄워 파일 선택
 *  3) /api/google/drive/pick-register POST — 권한 변경(anyone with link: viewer) + DB 등록
 *
 * 환경변수:
 *  - NEXT_PUBLIC_GOOGLE_CLIENT_ID  : Google OAuth 2.0 Client ID
 *  - NEXT_PUBLIC_GOOGLE_API_KEY    : Browser API key (Picker 스크립트용)
 *
 * 사용:
 *  <DrivePickerButton targetType="project" targetId={id} onPicked={...} />
 *  <DrivePickerButton targetType="group" targetId={id} />
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { HardDrive, Loader2 } from "lucide-react";

declare global {
  interface Window {
    gapi?: any;
    google?: any;
    __nu_picker_inited?: boolean;
  }
}

interface Props {
  targetType: "project" | "group";
  targetId: string;
  onPicked?: (files: Array<{ id: string; name: string; url: string }>) => void;
  label?: string;
  className?: string;
}

export function DrivePickerButton({ targetType, targetId, onPicked, label = "Drive 에서 가져오기", className }: Props) {
  const [loading, setLoading] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.__nu_picker_inited) {
      setScriptReady(true);
      return;
    }

    let gapiLoaded = false;
    let gisLoaded = false;
    const maybeReady = () => {
      if (gapiLoaded && gisLoaded) {
        window.__nu_picker_inited = true;
        setScriptReady(true);
      }
    };

    // gapi (Picker)
    if (!document.getElementById("gapi-script")) {
      const s = document.createElement("script");
      s.id = "gapi-script";
      s.src = "https://apis.google.com/js/api.js";
      s.async = true;
      s.defer = true;
      s.onload = () => {
        window.gapi?.load("picker", () => {
          gapiLoaded = true;
          maybeReady();
        });
      };
      document.head.appendChild(s);
    } else {
      window.gapi?.load("picker", () => {
        gapiLoaded = true;
        maybeReady();
      });
    }

    // GIS (OAuth token)
    if (!document.getElementById("gis-script")) {
      const s = document.createElement("script");
      s.id = "gis-script";
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = () => {
        gisLoaded = true;
        maybeReady();
      };
      document.head.appendChild(s);
    } else {
      gisLoaded = true;
      maybeReady();
    }
  }, []);

  async function open() {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!apiKey || !clientId) {
      toast.error("Google Picker 환경변수 미설정 — 관리자에게 문의");
      return;
    }
    if (!scriptReady) {
      toast.error("Google 스크립트 로딩 중 — 잠시 후 다시 시도");
      return;
    }
    setLoading(true);
    try {
      const token = await getOAuthToken(clientId);
      await showPicker({ apiKey, token, onSelect: onFiles });
    } catch (err: any) {
      if (err?.type === "popup_closed") {
        /* 사용자 닫음 — 무시 */
      } else {
        toast.error("Drive 연결 실패: " + (err?.message || String(err)));
      }
    } finally {
      setLoading(false);
    }
  }

  async function onFiles(files: Array<{ id: string; name: string; mimeType: string; url: string }>) {
    if (!files.length) return;
    // 서버에 등록 — 권한 변경 + 자료실 insert
    try {
      const res = await fetch("/api/google/drive/pick-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          files: files.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, url: f.url })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "등록 실패");
      toast.success(
        `${files.length}개 자료실 등록 · 권한 ${data.permissionsUpdated}개 자동 변경`,
      );
      onPicked?.(files);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <button
      onClick={open}
      disabled={loading}
      className={
        className ||
        "inline-flex items-center gap-1.5 px-3 py-2 border-[2px] border-nu-blue bg-nu-blue/10 text-nu-blue rounded text-[12px] font-mono-nu uppercase tracking-widest font-bold hover:bg-nu-blue hover:text-white transition-colors disabled:opacity-50"
      }
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <HardDrive size={12} />}
      {label}
    </button>
  );
}

/* ---------- 헬퍼 ---------- */

function getOAuthToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const google = window.google;
    if (!google?.accounts?.oauth2) return reject(new Error("GIS not ready"));
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope:
        "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file",
      callback: (resp: any) => {
        if (resp.access_token) resolve(resp.access_token);
        else reject(new Error("No access token"));
      },
      error_callback: (err: any) => reject(err),
    });
    client.requestAccessToken({ prompt: "" });
  });
}

function showPicker({
  apiKey,
  token,
  onSelect,
}: {
  apiKey: string;
  token: string;
  onSelect: (files: any[]) => void;
}): Promise<void> {
  return new Promise((resolve) => {
    const google = window.google;
    if (!google?.picker) {
      resolve();
      return;
    }
    const view = new google.picker.DocsView()
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)
      .setOwnedByMe(true);

    const picker = new google.picker.PickerBuilder()
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
      .addView(view)
      .addView(new google.picker.DocsView().setIncludeFolders(true).setOwnedByMe(false))
      .setOAuthToken(token)
      .setDeveloperKey(apiKey)
      .setCallback((data: any) => {
        if (data.action === google.picker.Action.PICKED) {
          const files = (data.docs || []).map((d: any) => ({
            id: d.id,
            name: d.name,
            mimeType: d.mimeType,
            url: d.url || `https://drive.google.com/file/d/${d.id}/view`,
          }));
          onSelect(files);
          resolve();
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve();
        }
      })
      .build();
    picker.setVisible(true);
  });
}
