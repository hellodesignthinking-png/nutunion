"use client";

import { useEffect, useRef, useState } from "react";
import { HardDrive, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DriveFile {
  name: string;
  url: string;
  mimeType: string;
}

interface DrivePickerProps {
  onFilePicked: (file: DriveFile) => void;
}

// Load Google APIs
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || "";
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const SCOPES = "https://www.googleapis.com/auth/drive.readonly";

export function DrivePicker({ onFilePicked }: DrivePickerProps) {
  const [loading, setLoading] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const pickerInittedRef = useRef(false);

  useEffect(() => {
    // Pre-load gapi and gsi scripts
    loadScript("https://apis.google.com/js/api.js").catch(console.error);
    loadScript("https://accounts.google.com/gsi/client").catch(console.error);
  }, []);

  async function openPicker() {
    if (!API_KEY || !CLIENT_ID) {
      toast.error("구글 드라이브 API 키가 설정되지 않았습니다. .env.local을 확인해주세요.", { duration: 5000 });
      return;
    }

    setLoading(true);
    try {
      await loadScript("https://apis.google.com/js/api.js");
      await loadScript("https://accounts.google.com/gsi/client");

      // Load gapi picker
      await new Promise<void>((resolve) => {
        (window as any).gapi.load("picker", () => resolve());
      });

      // Get OAuth token via Google Identity Services
      const token = await new Promise<string>((resolve, reject) => {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (resp: any) => {
            if (resp.error) reject(new Error(resp.error));
            else resolve(resp.access_token);
          },
        });
        client.requestAccessToken({ prompt: tokenRef.current ? "" : "consent" });
      });

      tokenRef.current = token;

      // Build and show Picker
      const picker = new (window as any).google.picker.PickerBuilder()
        .addView(new (window as any).google.picker.DocsView()
          .setIncludeFolders(true)
          .setSelectFolderEnabled(false))
        .addView(new (window as any).google.picker.DocsUploadView())
        .setOAuthToken(token)
        .setDeveloperKey(API_KEY)
        .setCallback((data: any) => {
          const { action, docs } = data;
          if (action === "picked" && docs?.[0]) {
            const doc = docs[0];
            onFilePicked({
              name: doc.name,
              url: doc.url || `https://drive.google.com/open?id=${doc.id}`,
              mimeType: doc.mimeType || "application/octet-stream",
            });
          }
        })
        .build();

      picker.setVisible(true);
    } catch (err: any) {
      console.error("Drive Picker error:", err);
      toast.error("구글 드라이브를 열지 못했습니다: " + (err.message || "알 수 없는 오류"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={openPicker}
      disabled={loading}
      className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-4 py-2.5 bg-green-600 text-white hover:bg-green-700 transition-colors inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : <HardDrive size={13} />}
      {loading ? "로딩..." : "Drive 연결"}
    </button>
  );
}
