"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { SpaceBlock } from "../space-pages-types";

interface AudioData {
  url?: string;
  duration_sec?: number;
  mime?: string;
}

interface Props {
  block: SpaceBlock;
  onChange: (patch: Partial<SpaceBlock>) => void;
}

const MAX_DURATION_SEC = 60;
const MAX_BYTES = 1_500_000; // 1.5MB — base64 면 약 2MB jsonb

/**
 * 음성 메모 블록 — 브라우저 MediaRecorder 로 녹음 후 data URL 로 jsonb 저장.
 *
 * 30~60초 사이 짧은 메모 용도. 더 긴 오디오는 추후 supabase storage 로.
 * 캡션은 block.content 에 (선택).
 */
export function AudioBlock({ block, onChange }: Props) {
  const data = (block.data as AudioData | undefined) ?? {};
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("이 브라우저는 녹음을 지원하지 않아요");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size > MAX_BYTES) {
          toast.error(`녹음 파일이 너무 커요 (${(blob.size / 1024 / 1024).toFixed(1)}MB) — 60초 이내로`);
          return;
        }
        const dataUrl = await blobToDataUrl(blob);
        const dur = Math.round((Date.now() - startTimeRef.current) / 1000);
        onChange({ data: { ...(block.data || {}), url: dataUrl, mime, duration_sec: dur } });
      };
      recorder.start();
      startTimeRef.current = Date.now();
      setRecording(true);
      setElapsed(0);
      tickRef.current = setInterval(() => {
        const sec = Math.round((Date.now() - startTimeRef.current) / 1000);
        setElapsed(sec);
        if (sec >= MAX_DURATION_SEC) {
          stopRecording();
          toast.info(`최대 ${MAX_DURATION_SEC}초 — 자동 종료`);
        }
      }, 250);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "마이크 권한 거부");
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    setRecording(false);
  }

  function clearAudio() {
    if (!window.confirm("녹음을 삭제할까요?")) return;
    onChange({ data: { ...(block.data || {}), url: undefined, duration_sec: undefined } });
  }

  if (!data.url) {
    return (
      <div className="my-1 border-[2px] border-dashed border-nu-ink/30 bg-nu-cream/20 px-3 py-3">
        <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2 flex items-center gap-1.5">
          🎙 음성 메모 — 최대 {MAX_DURATION_SEC}초
        </div>
        {recording ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={stopRecording}
              className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 border-[2px] border-red-700 bg-red-700 text-white flex items-center gap-1.5 animate-pulse"
            >
              <Square size={11} /> 녹음 중지
            </button>
            <span className="font-mono-nu text-[12px] text-red-700 font-bold">
              ● {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink bg-nu-ink text-nu-paper hover:bg-nu-pink flex items-center gap-1.5"
          >
            <Mic size={11} /> 녹음 시작
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="my-1 border-[2px] border-nu-ink bg-nu-cream/30 px-3 py-2 flex items-center gap-2">
      <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
        🎙 {data.duration_sec ? `${data.duration_sec}초` : "음성"}
      </span>
      <audio
        controls
        src={data.url}
        className="flex-1 h-8"
        style={{ minWidth: 200 }}
      />
      <button
        type="button"
        onClick={clearAudio}
        className="text-nu-muted hover:text-red-600 p-1"
        title="삭제"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("blob 읽기 실패"));
    reader.readAsDataURL(blob);
  });
}
