"use client";

/**
 * AudioTranscribe — 마이크 녹음 또는 오디오 파일 업로드 → Whisper 로 전사 → onText 콜백.
 *
 * 사용처: 회의 상세 페이지의 회의록 작성 영역에 임베드.
 *
 * 흐름:
 *  1) 녹음 (MediaRecorder) 또는 파일 첨부
 *  2) 4MB 미만 → /api/ai/transcribe 직접 (multipart)
 *     4MB 이상 → R2 업로드 후 file_url 모드로 전사
 *  3) 받은 텍스트를 onText 콜백으로 전달 (호출자가 어디에 붙일지 결정)
 */

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, Upload, FileAudio } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onText: (text: string, meta: { language?: string | null; duration?: number | null }) => void;
  /** 한국어 인명·전문용어 힌트 — Whisper prompt 로 전달 */
  prompt?: string;
  className?: string;
  scopeId?: string; // R2 prefix scope
}

const SOFT_LIMIT = 4 * 1024 * 1024; // 4MB — Vercel multipart 안전선

export function AudioTranscribe({ onText, prompt, className = "", scopeId }: Props) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      recorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: pickMime() });
      recorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        await transcribeBlob(blob, `recording.${blob.type.includes("mp4") ? "m4a" : "webm"}`);
      };
      mr.start();
      setSeconds(0);
      tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      setRecording(true);
    } catch (e: any) {
      toast.error("마이크 접근 실패: " + (e?.message || "권한 거부"));
    }
  }

  function stopRecording() {
    if (!recorderRef.current) return;
    recorderRef.current.stop();
    if (tickRef.current) clearInterval(tickRef.current);
    setRecording(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;
    await transcribeBlob(file, file.name);
  }

  async function transcribeBlob(blob: Blob, name: string) {
    setTranscribing(true);
    try {
      let result: Response;
      if (blob.size <= SOFT_LIMIT) {
        // multipart 직접
        const fd = new FormData();
        fd.append("audio", new File([blob], name, { type: blob.type }));
        fd.append("language", "ko");
        if (prompt) fd.append("prompt", prompt);
        result = await fetch("/api/ai/transcribe", { method: "POST", body: fd });
      } else {
        // R2 업로드 후 file_url 모드
        toast("긴 오디오 — R2 업로드 후 전사합니다");
        const { uploadFile } = await import("@/lib/storage/upload-client");
        const file = blob instanceof File ? blob : new File([blob], name, { type: blob.type });
        const up = await uploadFile(file, { prefix: "uploads", scopeId });
        result = await fetch("/api/ai/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_url: up.url,
            file_name: up.name,
            language: "ko",
            prompt,
          }),
        });
      }
      const json = await result.json();
      if (!result.ok) {
        if (json?.code === "NOT_CONFIGURED") {
          toast.error("관리자 설정 필요 — OPENAI_API_KEY");
        } else {
          toast.error(json?.error || "전사 실패");
        }
        return;
      }
      const text = (json.text || "").trim();
      if (!text) {
        toast.error("음성에서 텍스트를 추출하지 못했어요");
        return;
      }
      onText(text, { language: json.language, duration: json.duration });
      toast.success(
        `전사 완료${json.duration ? ` · ${Math.round(json.duration)}초` : ""}${json.language ? ` · ${json.language}` : ""}`,
      );
    } catch (e: any) {
      toast.error(e?.message || "전사 실패");
    } finally {
      setTranscribing(false);
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {!recording ? (
        <button
          type="button"
          onClick={startRecording}
          disabled={transcribing}
          className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-2 border-2 border-nu-ink bg-nu-paper text-nu-ink hover:bg-nu-pink hover:text-white hover:border-nu-pink transition-all flex items-center gap-1.5 disabled:opacity-50"
        >
          {transcribing ? <Loader2 size={12} className="animate-spin" /> : <Mic size={12} />}
          {transcribing ? "전사 중..." : "🎙️ 녹음 + 전사"}
        </button>
      ) : (
        <button
          type="button"
          onClick={stopRecording}
          className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-2 border-2 border-red-500 bg-red-500 text-white hover:bg-red-600 transition-all flex items-center gap-1.5 animate-pulse"
        >
          <Square size={12} /> 중지 ({fmtTime(seconds)})
        </button>
      )}

      <label
        className={`font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-2 border-2 border-nu-ink/20 text-nu-muted hover:border-nu-ink hover:text-nu-ink transition-all flex items-center gap-1.5 cursor-pointer ${transcribing || recording ? "opacity-50 pointer-events-none" : ""}`}
        title="m4a / mp3 / wav / webm 등 25MB 이하"
      >
        <FileAudio size={12} /> 오디오 파일 첨부
        <input
          type="file"
          accept="audio/*,video/mp4,video/webm"
          className="hidden"
          onChange={handleFileUpload}
        />
      </label>
    </div>
  );
}

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported?.(c)) return c;
  }
  return "audio/webm";
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${m}:${ss}`;
}
