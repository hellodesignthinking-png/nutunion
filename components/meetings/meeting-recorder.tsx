"use client";

import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Mic,
  Pause,
  Play,
  Square,
  Upload,
  Loader2,
  AlertCircle,
  Sparkles,
  HardDrive,
  Link2,
  X,
} from "lucide-react";

/* ─── Types ─── */
interface MeetingRecorderProps {
  meetingId: string;
  meetingTitle: string;
  meetingStatus: string;
  canEdit: boolean;
  /** After recording+transcription, call this to switch to AI notes tab */
  onTranscriptionComplete?: () => void;
  /** Notifies parent whenever a recording is ready/cleared — lets parent "conclude with recording" */
  onAudioReady?: (blob: Blob | null, mime: string | null) => void;
  /** 볼트 탭 컨텍스트 — 설정 시 meetings 테이블 대신 project_resources / bolt_taps 에 저장 */
  projectId?: string;
}

export interface MeetingRecorderHandle {
  /** If actively recording, stop and wait for the blob to be assembled. Returns blob+mime or null. */
  stopAndGetBlob: () => Promise<{ blob: Blob; mime: string } | null>;
  /** True if a recording is in progress. */
  isRecording: () => boolean;
  /** Currently captured blob, if any. */
  getCurrentBlob: () => { blob: Blob; mime: string } | null;
}

type RecordingState = "idle" | "recording" | "paused" | "processing" | "done";

/* ─── Helper: format seconds to MM:SS or HH:MM:SS ─── */
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function normalizeMimeType(mimeType: string | undefined | null): string {
  return (mimeType || "").split(";")[0] || "audio/webm";
}

function getAudioExtension(mimeType: string): string {
  switch (normalizeMimeType(mimeType)) {
    case "audio/mp4":
    case "audio/x-m4a":
      return "m4a";
    case "audio/mpeg":
    case "audio/mp3":
      return "mp3";
    case "audio/wav":
      return "wav";
    case "audio/ogg":
      return "ogg";
    case "audio/flac":
      return "flac";
    default:
      return "webm";
  }
}

/* ─── Helper: File → Base64 ─── */
function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ─── Main Component ─── */
export const MeetingRecorder = forwardRef<MeetingRecorderHandle, MeetingRecorderProps>(function MeetingRecorder({
  meetingId,
  meetingTitle,
  meetingStatus,
  canEdit,
  onTranscriptionComplete,
  onAudioReady,
  projectId,
}, ref) {
  // bolt-tap-* 형태의 가짜 meetingId 감지 — meetings 테이블 조회 건너뜀
  const isBoltTapMode = meetingId.startsWith("bolt-tap-") || !!projectId;
  const [state, setState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [showDriveImport, setShowDriveImport] = useState(false);
  const [driveUrl, setDriveUrl] = useState("");
  const [driveImporting, setDriveImporting] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [supported, setSupported] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pendingStopResolveRef = useRef<((val: { blob: Blob; mime: string } | null) => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Check MediaRecorder support
  useEffect(() => {
    if (typeof window !== "undefined" && !navigator.mediaDevices?.getUserMedia) {
      setSupported(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Waveform visualization ─────────────────────────────────────────
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
      if (!canvas || !analyser || !ctx) return;
      animFrameRef.current = requestAnimationFrame(draw);

      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = "#e91e63"; // nu-pink
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    }

    draw();
  }, []);

  // ── Start recording ────────────────────────────────────────────────
  async function handleStart() {
    try {
      // 1) 보안 컨텍스트 체크 — getUserMedia 는 HTTPS/localhost 에서만 작동
      if (typeof window !== "undefined" && !window.isSecureContext) {
        toast.error("HTTPS 환경에서만 녹음이 가능합니다", {
          description: "localhost 또는 https:// 도메인에서 접속해주세요.",
        });
        return;
      }

      // 2) 사전 권한 상태 조회 (가능한 브라우저 한정)
      try {
        const perm = await (navigator as any).permissions?.query?.({ name: "microphone" as PermissionName });
        if (perm?.state === "denied") {
          toast.error("마이크 접근이 '차단됨' 상태입니다", {
            description:
              "주소창의 자물쇠 아이콘 → 사이트 설정 → 마이크를 '허용'으로 바꾼 뒤 페이지를 새로고침하세요.",
            duration: 8000,
          });
          return;
        }
      } catch {
        /* 권한 API 미지원 브라우저 — 바로 getUserMedia 시도 */
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup audio analyser for waveform
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Pick best available mime type
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Notify parent that a blob is ready
        try { onAudioReady?.(blob, normalizeMimeType(mimeType)); } catch { /* noop */ }

        // Resolve any pending stopAndGetBlob awaiters
        if (pendingStopResolveRef.current) {
          pendingStopResolveRef.current({ blob, mime: normalizeMimeType(mimeType) });
          pendingStopResolveRef.current = null;
        }

        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
      };

      recorder.start(1000); // Collect data every second
      setState("recording");
      setElapsed(0);
      setAudioBlob(null);
      setAudioUrl(null);

      // Start timer
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);

      // Start waveform
      drawWaveform();

      toast.success("녹음이 시작되었습니다", {
        description: "마이크가 활성화되었습니다. 회의를 진행하세요.",
      });
    } catch (err: unknown) {
      console.error("Recording error:", err);
      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || err.message.includes("Permission denied")) {
          toast.error("마이크 권한이 필요합니다", {
            description: "브라우저 설정 또는 주소창의 자물쇠 아이콘을 눌러 마이크 접근을 허용해주세요.",
          });
        } else if (err.name === "NotFoundError" || err.message.includes("Requested device not found")) {
          toast.error("마이크 장치를 찾을 수 없습니다 🎙️", {
            description: "컴퓨터에 연결된 마이크가 없거나 브라우저가 인식하지 못하고 있습니다. 이어폰이나 마이크를 연결한 뒤 다시 시도해주세요.",
          });
        } else {
          toast.error("녹음을 시작할 수 없습니다: " + err.message);
        }
      } else {
        toast.error("녹음을 시작할 수 없습니다: 알 수 없는 오류");
      }
    }
  }

  // ── Pause/Resume ───────────────────────────────────────────────────
  function handlePause() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (recorder.state === "recording") {
      recorder.pause();
      setState("paused");
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    } else if (recorder.state === "paused") {
      recorder.resume();
      setState("recording");
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
      drawWaveform();
    }
  }

  // ── Stop recording ─────────────────────────────────────────────────
  function handleStop() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    recorder.stop();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setState("done");
    toast.success("녹음이 완료되었습니다", {
      description: "녹음 파일을 확인하고 AI 회의록으로 변환하세요.",
    });
  }

  async function handleUploadAndTranscribe() {
    if (!audioBlob) return;

    setState("processing");
    setProcessingStep("서버에 녹음 파일 저장 중...");

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다");

      const normalizedMimeType = normalizeMimeType(audioBlob.type);
      const ext = getAudioExtension(normalizedMimeType);
      const displayName = `recording_${Date.now()}.${ext}`;

      // [Drive migration Phase 3a] content now stored on R2.
      // Blob → File 로 감싸서 uploadFile 에 전달 (R2 우선, 실패 시 Supabase fallback).
      const audioFile = new File([audioBlob], displayName, { type: normalizedMimeType });
      const { uploadFile } = await import("@/lib/storage/upload-client");
      const up = await uploadFile(audioFile, { prefix: "resources", scopeId: meetingId });
      const publicUrl = up.url;
      const fileName = up.key;

      // 볼트 탭 모드: meetings 테이블 조회 없이 project_resources 에 직접 저장
      if (isBoltTapMode && projectId) {
        const prPayload: any = {
          project_id: projectId,
          name: displayName,
          url: publicUrl,
          type: "audio",
          stage: "evidence",
          uploaded_by: user.id,
          storage_type: up.storage,
          storage_key: up.key,
        };
        let { error: prErr } = await supabase.from("project_resources").insert(prPayload);
        if (prErr && /storage_type|storage_key/.test(prErr.message)) {
          delete prPayload.storage_type;
          delete prPayload.storage_key;
          await supabase.from("project_resources").insert(prPayload);
        }
      } else if (!isBoltTapMode) {
        const { data: mtg, error: meetingError } = await supabase
          .from("meetings")
          .select("group_id, project_id")
          .eq("id", meetingId)
          .single();
        if (meetingError) throw new Error("회의 정보를 불러오지 못했습니다");

        // [Drive migration Phase 3a] Google Drive 이관 단계 제거 — R2 가 canonical.
        if (mtg?.group_id) {
          const faPayload: any = {
            target_type: "group",
            target_id: mtg.group_id,
            uploaded_by: user.id,
            file_name: displayName,
            file_url: publicUrl,
            file_size: audioBlob.size,
            file_type: normalizedMimeType,
            storage_type: up.storage,
            storage_key: up.key,
          };
          let { error: faErr } = await supabase.from("file_attachments").insert(faPayload);
          if (faErr && /storage_type|storage_key/.test(faErr.message)) {
            delete faPayload.storage_type;
            delete faPayload.storage_key;
            await supabase.from("file_attachments").insert(faPayload);
          }
        } else if (mtg?.project_id) {
          const prPayload: any = {
            project_id: mtg.project_id,
            name: displayName,
            url: publicUrl,
            type: "audio",
            stage: "evidence",
            uploaded_by: user.id,
            storage_type: up.storage,
            storage_key: up.key,
          };
          let { error: prErr } = await supabase.from("project_resources").insert(prPayload);
          if (prErr && /storage_type|storage_key/.test(prErr.message)) {
            delete prPayload.storage_type;
            delete prPayload.storage_key;
            await supabase.from("project_resources").insert(prPayload);
          }
        }
      }

      setProcessingStep("AI가 회의 내용을 분석 중 (최대 1~2분 소요)...");
      const res = await fetch("/api/ai/meeting-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: null,
          agendas: [],
          meetingTitle,
          audioUrl: publicUrl,
          audioMimeType: normalizedMimeType,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `AI 분석 실패 (${res.status})`);
      }

      const result = await res.json();

      if (result.summary) {
        if (isBoltTapMode && projectId) {
          // 볼트 탭 모드: bolt_taps 에 저장
          await supabase
            .from("bolt_taps")
            .update({
              content_md: result.summary,
              last_edited_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("project_id", projectId);
        } else {
          await supabase
            .from("meetings")
            .update({ summary: result.summary })
            .eq("id", meetingId);
        }
      }

      if (!isBoltTapMode && (result.discussions?.length || result.decisions?.length)) {
        const notes: { meeting_id: string; content: string; type: string; created_by: string }[] = [];
        result.discussions?.forEach((d: string) => notes.push({ meeting_id: meetingId, content: d, type: "note", created_by: user.id }));
        result.decisions?.forEach((d: string) => notes.push({ meeting_id: meetingId, content: d, type: "decision", created_by: user.id }));
        result.actionItems?.forEach((a: { task: string }) => notes.push({ meeting_id: meetingId, content: a.task, type: "action_item", created_by: user.id }));
        if (notes.length > 0) {
          await supabase.from("meeting_notes").insert(notes);
        }
      }

      // [Drive migration Phase 3a] R2 가 canonical — 별도 cleanup 없음.
      void fileName; // referenced just to keep key available for future debugging

      setState("done");
      setProcessingStep("");
      toast.success("회의록이 성공적으로 완성되었습니다!", {
        description: "녹음이 서버에 보관되고 AI 분석이 완료되었습니다.",
      });
      onTranscriptionComplete?.();
    } catch (err: unknown) {
      console.error("Upload/transcribe error:", err);
      toast.error(err instanceof Error ? err.message : "처리 중 오류가 발생했습니다");
      setState("done"); 
      setProcessingStep("");
    }
  }

  // ── Google Drive import ────────────────────────────────────────────
  async function handleDriveImport() {
    if (!driveUrl.trim()) return;
    setDriveImporting(true);

    try {
      // Extract file ID from Drive URL
      const match = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (!match) {
        toast.error("유효한 Google Drive URL이 아닙니다", {
          description: "drive.google.com/file/d/... 형식의 URL을 입력해주세요.",
        });
        setDriveImporting(false);
        return;
      }

      const fileId = match[1];

      // Try to fetch through our API proxy
      const res = await fetch("/api/google/drive/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, meetingId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // If API doesn't exist, provide manual instructions
        if (res.status === 404) {
          toast.info("Google Drive 파일을 직접 다운로드 후 업로드해주세요", {
            description: "파일 업로드 버튼을 사용하세요.",
            duration: 6000,
          });
          setShowDriveImport(false);
          setDriveImporting(false);
          return;
        }
        throw new Error(err.error || "Drive 파일 가져오기 실패");
      }

      const data = await res.json();
      toast.success("Drive 파일을 가져왔습니다. AI 분석을 시작합니다...");

      // If we got audioBase64 back, send to transcription
      if (data.audioBase64) {
        setState("processing");
        setProcessingStep("AI가 회의 내용을 분석 중...");

        const summaryRes = await fetch("/api/ai/meeting-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notes: null,
            agendas: [],
            meetingTitle,
            audioBase64: data.audioBase64,
            audioMimeType: data.mimeType || "audio/mpeg",
          }),
        });

        if (summaryRes.ok) {
          const result = await summaryRes.json();
          const supabase = createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (result.summary && user) {
            if (isBoltTapMode && projectId) {
              await supabase
                .from("bolt_taps")
                .update({
                  content_md: result.summary,
                  last_edited_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq("project_id", projectId);
            } else {
              await supabase
                .from("meetings")
                .update({ summary: result.summary })
                .eq("id", meetingId);
            }
          }
          toast.success("Drive 녹음 파일에서 회의록이 생성되었습니다!");
          onTranscriptionComplete?.();
        }

        setState("idle");
        setProcessingStep("");
      }

      setShowDriveImport(false);
      setDriveUrl("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Drive 가져오기 실패");
    } finally {
      setDriveImporting(false);
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────
  function handleReset() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setElapsed(0);
    setState("idle");
    try { onAudioReady?.(null, null); } catch { /* noop */ }
  }

  // Expose imperative API to parent (stop + retrieve blob in one call)
  useImperativeHandle(ref, () => ({
    isRecording: () => {
      const r = mediaRecorderRef.current;
      return !!r && (r.state === "recording" || r.state === "paused");
    },
    getCurrentBlob: () => {
      if (!audioBlob) return null;
      return { blob: audioBlob, mime: normalizeMimeType(audioBlob.type) };
    },
    stopAndGetBlob: () => {
      const recorder = mediaRecorderRef.current;
      // No active recording — return current blob (if any)
      if (!recorder || recorder.state === "inactive") {
        if (audioBlob) {
          return Promise.resolve({ blob: audioBlob, mime: normalizeMimeType(audioBlob.type) });
        }
        return Promise.resolve(null);
      }
      return new Promise((resolve) => {
        pendingStopResolveRef.current = resolve;
        try {
          recorder.stop();
        } catch {
          resolve(null);
          pendingStopResolveRef.current = null;
          return;
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setState("done");
        // Safety timeout — if onstop never fires, resolve null after 5s
        setTimeout(() => {
          if (pendingStopResolveRef.current === resolve) {
            pendingStopResolveRef.current = null;
            resolve(null);
          }
        }, 5000);
      });
    },
  }));

  // ── Only show when meeting is in_progress or just completed ──────
  if (meetingStatus !== "in_progress" && meetingStatus !== "completed") {
    return null;
  }

  // Not supported
  if (!supported) {
    return (
      <div className="bg-amber-50 border border-amber-200 p-3 flex items-center gap-2 mb-4">
        <AlertCircle size={14} className="text-amber-600" />
        <span className="text-xs text-amber-800">
          이 브라우저에서는 녹음이 지원되지 않습니다. Chrome 또는 Safari를 사용해주세요.
        </span>
      </div>
    );
  }

  return (
    <div className="mb-4 bg-white border-2 border-nu-ink overflow-hidden">
      {/* Header */}
      <div className="bg-nu-ink text-white px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic size={14} className={state === "recording" ? "text-red-400 animate-pulse" : "text-nu-pink"} />
          <span className="font-head text-sm font-bold">회의 녹음</span>
          {state === "recording" && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="font-mono-nu text-[11px] text-red-300 uppercase tracking-widest">REC</span>
            </span>
          )}
          {state === "paused" && (
            <span className="font-mono-nu text-[11px] text-amber-300 uppercase tracking-widest">일시정지</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Timer */}
          {(state === "recording" || state === "paused" || state === "done") && (
            <span className="font-mono-nu text-xs text-white/60 tabular-nums">{formatTime(elapsed)}</span>
          )}
          {/* Drive import toggle */}
          {state === "idle" && (
            <button
              onClick={() => setShowDriveImport(!showDriveImport)}
              className="font-mono-nu text-[10px] uppercase tracking-widest text-white/40 hover:text-white transition-colors flex items-center gap-1"
            >
              <HardDrive size={10} /> Drive 가져오기
            </button>
          )}
        </div>
      </div>

      {/* Waveform + Controls */}
      <div className="p-4">
        {/* Waveform canvas */}
        {(state === "recording" || state === "paused") && (
          <div className="mb-3 bg-nu-ink/[0.03] border border-nu-ink/[0.08] p-2">
            <canvas
              ref={canvasRef}
              width={600}
              height={60}
              className="w-full h-[60px]"
            />
          </div>
        )}

        {/* Audio playback after recording */}
        {state === "done" && audioUrl && (
          <div className="mb-3 bg-nu-cream/30 border border-nu-ink/[0.08] p-3">
            <audio controls src={audioUrl} className="w-full h-8" />
          </div>
        )}

        {/* Processing state */}
        {state === "processing" && (
          <div className="mb-3 flex items-center justify-center gap-3 py-6">
            <div className="relative">
              <Loader2 size={24} className="animate-spin text-nu-pink" />
              <Sparkles size={10} className="absolute -top-1 -right-1 text-nu-amber" />
            </div>
            <div>
              <p className="text-sm font-bold text-nu-ink">{processingStep}</p>
              <p className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest">
                잠시 기다려주세요...
              </p>
            </div>
          </div>
        )}

        {/* Control buttons */}
        <div className="flex items-center gap-2">
          {state === "idle" && (
            <>
              <button
                onClick={handleStart}
                disabled={!canEdit || meetingStatus !== "in_progress"}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 text-white font-head text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Mic size={16} />
                녹음 시작
              </button>
              {/* File upload as fallback */}
              <label className="flex items-center justify-center gap-1.5 px-3 py-2.5 border-2 border-nu-ink/20 text-nu-graphite font-mono-nu text-[12px] uppercase tracking-widest hover:border-nu-ink/40 transition-colors cursor-pointer">
                <Upload size={14} />
                파일 업로드
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.aac,.flac"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setAudioBlob(file);
                    setAudioUrl(URL.createObjectURL(file));
                    setState("done");
                    toast.success(`"${file.name}" 로드 완료`);
                  }}
                />
              </label>
            </>
          )}

          {state === "recording" && (
            <>
              <button
                onClick={handlePause}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-500 text-white font-mono-nu text-[13px] uppercase tracking-widest font-bold hover:bg-amber-600 transition-colors"
              >
                <Pause size={14} /> 일시정지
              </button>
              <button
                onClick={handleStop}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-nu-ink text-white font-head text-sm font-bold hover:bg-nu-graphite transition-colors"
              >
                <Square size={14} /> 녹음 종료
              </button>
            </>
          )}

          {state === "paused" && (
            <>
              <button
                onClick={handlePause}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-green-500 text-white font-mono-nu text-[13px] uppercase tracking-widest font-bold hover:bg-green-600 transition-colors"
              >
                <Play size={14} /> 재개
              </button>
              <button
                onClick={handleStop}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-nu-ink text-white font-head text-sm font-bold hover:bg-nu-graphite transition-colors"
              >
                <Square size={14} /> 녹음 종료
              </button>
            </>
          )}

          {state === "done" && audioBlob && (
            <>
              <button
                onClick={handleUploadAndTranscribe}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-nu-pink to-purple-500 text-white font-head text-sm font-bold hover:from-nu-pink/90 hover:to-purple-500/90 transition-colors shadow-[3px_3px_0px_rgba(233,30,99,0.25)]"
              >
                <Sparkles size={16} />
                AI 회의록 변환
              </button>
              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-1 px-3 py-2.5 border-2 border-nu-ink/20 text-nu-muted font-mono-nu text-[12px] uppercase tracking-widest hover:border-red-300 hover:text-red-500 transition-colors"
              >
                <X size={12} /> 다시 녹음
              </button>
            </>
          )}
        </div>

        {/* Idle helper text */}
        {state === "idle" && meetingStatus === "in_progress" && (
          <p className="mt-2 text-center font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest">
            녹음 버튼을 눌러 회의를 녹음하세요 · 완료 후 AI가 자동으로 회의록을 생성합니다
          </p>
        )}
        {state === "idle" && meetingStatus === "completed" && (
          <p className="mt-2 text-center font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest">
            녹음 파일을 업로드하거나 Drive에서 가져와 회의록을 생성하세요
          </p>
        )}
      </div>

      {/* Google Drive import panel */}
      {showDriveImport && (
        <div className="border-t-2 border-nu-ink/10 p-4 bg-blue-50/50">
          <div className="flex items-center gap-2 mb-3">
            <HardDrive size={14} className="text-blue-600" />
            <span className="font-head text-sm font-bold text-blue-900">Google Drive 녹음 가져오기</span>
          </div>
          <p className="text-xs text-blue-800/70 mb-3">
            Google Drive에 저장된 녹음 파일의 공유 링크를 붙여넣으세요. 파일은 공유 설정이 필요합니다.
          </p>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" />
              <input
                type="text"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-blue-200 focus:border-blue-400 focus:outline-none"
              />
            </div>
            <button
              onClick={handleDriveImport}
              disabled={driveImporting || !driveUrl.trim()}
              className="px-4 py-2 bg-blue-600 text-white font-mono-nu text-[12px] uppercase tracking-widest font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {driveImporting ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              가져오기
            </button>
            <button
              onClick={() => { setShowDriveImport(false); setDriveUrl(""); }}
              className="px-2 text-blue-400 hover:text-blue-600 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
