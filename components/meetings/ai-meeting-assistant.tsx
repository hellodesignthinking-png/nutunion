"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Sparkles,
  Mic,
  FileAudio,
  Upload,
  Loader2,
  Save,
  CheckCircle2,
  Edit3,
  Copy,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  ListChecks,
  MessageSquare,
  Target,
  ArrowRight,
  X,
  Link2,
  RefreshCw,
  Zap,
  TrendingUp,
  BookOpen,
  Heart,
} from "lucide-react";

/* ─── Types ─── */
interface AiMeetingAssistantProps {
  meetingId: string;
  meetingTitle: string;
  /** Meeting notes so far (from meeting_notes table) */
  existingNotes?: string[];
  /** Current meeting summary if any */
  existingSummary?: string;
  /** Compressed context from previous weekly digest (token-saving) */
  previousDigest?: string;
  /** Agendas for context */
  agendas?: { topic: string; description?: string }[];
  canEdit: boolean;
  /** Callback after AI generates summary and user saves */
  onSaveSummary?: (summary: string) => void | Promise<void>;
  onSaveNextTopic?: (topic: string) => void | Promise<void>;
  /** Callback to add notes to meeting_notes table */
  onAddNote?: (
    content: string,
    type: "note" | "action_item" | "decision",
    extra?: { dueDate?: string | null; priority?: string | null; assignee?: string | null }
  ) => void | Promise<void>;
  /** Callback to archive as Google Doc */
  onArchiveToGoogleDoc?: (title: string, content: string) => Promise<{ url?: string; error?: string } | void>;
  /** Callback to navigate to a specific tab */
  onNavigateTab?: (tab: string) => void;
  /** 자료실 audio 파일 목록 조회용 — group 또는 project id 중 하나 */
  groupId?: string;
  projectId?: string;
}

interface LibraryAudio {
  id: string;
  name: string;
  url: string;
  mime: string;
  size: number;
  uploaded_at: string;
}

interface QuoteRef {
  speaker: string;
  text: string;
  timestamp?: string | null;
}

interface TopicGroup {
  title: string;
  points: string[];
  quotes?: QuoteRef[];
}

interface SpeakerSummary {
  label: string;
  summary: string;
}

interface TranscriptLine {
  timestamp: string;
  speaker: string;
  text: string;
}

interface ActionItemRich {
  task: string;
  assignee?: string | null;
  dueDate?: string | null;
  priority?: "high" | "normal" | "low";
}

interface AiResult {
  summary: string;
  discussions: string[];
  decisions: string[];
  actionItems: ActionItemRich[];
  nextTopics: string[];
  // Plaud-style 새 필드 (optional)
  overview?: {
    gist?: string;
    attendees?: string[];
    durationMin?: number | null;
    date?: string | null;
  };
  topics?: TopicGroup[];
  quotes?: QuoteRef[];
  speakers?: SpeakerSummary[];
  openQuestions?: string[];
  transcript?: TranscriptLine[];
}

/* ─── Helper: Convert File to Base64 ─── */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:audio/...;base64, prefix
      const base64 = result.split(",")[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ─── Main Component ─── */
export function AiMeetingAssistant({
  meetingId,
  meetingTitle,
  existingNotes = [],
  existingSummary,
  previousDigest,
  agendas = [],
  canEdit,
  onSaveSummary,
  onSaveNextTopic,
  onAddNote,
  onArchiveToGoogleDoc,
  onNavigateTab,
  groupId,
  projectId,
}: AiMeetingAssistantProps) {
  const [rawNotes, setRawNotes] = useState(existingNotes.join("\n") || "");
  const [audioUrl, setAudioUrl] = useState("");
  const [showAudioInput, setShowAudioInput] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryAudios, setLibraryAudios] = useState<LibraryAudio[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [editingResult, setEditingResult] = useState(false);
  const [editedSummary, setEditedSummary] = useState("");
  const [saved, setSaved] = useState(false);

  // Sync rawNotes when existingNotes prop updates (e.g., after meeting_notes are fetched)
  const [prevNotesLength, setPrevNotesLength] = useState(existingNotes.length);
  if (existingNotes.length !== prevNotesLength) {
    setPrevNotesLength(existingNotes.length);
    if (existingNotes.length > 0 && !rawNotes.trim()) {
      setRawNotes(existingNotes.join("\n"));
    }
  }

  // Auto-save draft to localStorage (protects against accidental page close)
  const draftKey = `nutunion_draft_${meetingId}`;
  const [draftSaved, setDraftSaved] = useState(false);

  useEffect(() => {
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft && !rawNotes.trim() && existingNotes.length === 0) {
      setRawNotes(savedDraft);
      toast.info("이전에 작성 중이던 메모가 복구되었습니다", {
        description: "페이지를 떠났을 때 자동 저장된 드래프트입니다.",
        duration: 5000,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    if (rawNotes.trim()) {
      setDraftSaved(false);
      const timer = setTimeout(() => {
        localStorage.setItem(draftKey, rawNotes);
        setDraftSaved(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [rawNotes, draftKey]);

  // Clear draft after successful save
  useEffect(() => {
    if (saved) localStorage.removeItem(draftKey);
  }, [saved, draftKey]);

  // Keyboard shortcut: Ctrl+Enter to trigger AI analysis
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !processing && rawNotes.trim()) {
        e.preventDefault();
        handleAiProcess();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processing, rawNotes]);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    summary: true,
    discussions: true,
    decisions: true,
    actions: true,
    nextTopics: true,
    growth: true,
    learning: true,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  /* ── 자료실 audio 목록 로드 ─── */
  async function loadLibraryAudios() {
    if (!groupId && !projectId) {
      toast.error("자료실 맥락 정보 없음");
      return;
    }
    setLibraryLoading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const target_type = groupId ? "group" : "project";
      const target_id = groupId || projectId;
      const { data, error } = await supabase
        .from("file_attachments")
        .select("id, file_name, file_url, file_type, file_size, created_at")
        .eq("target_type", target_type)
        .eq("target_id", target_id!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const audios: LibraryAudio[] = ((data as any[]) || [])
        .filter((f) => {
          const mime = (f.file_type || "").toLowerCase();
          const name = (f.file_name || "").toLowerCase();
          if (mime.startsWith("audio/")) return true;
          if (/\.(mp3|wav|m4a|ogg|webm|aac|flac)$/i.test(name)) return true;
          // chat-upload 가 PDF/audio 를 mp4 로 위장시킨 케이스 (disguiseMimeForSupabase) 까지 포괄
          if (/recording_\d+\.(webm|mp4|m4a)/i.test(name)) return true;
          return false;
        })
        .map((f) => ({
          id: f.id,
          name: f.file_name,
          url: f.file_url,
          mime: f.file_type || "audio/webm",
          size: f.file_size || 0,
          uploaded_at: f.created_at,
        }));
      setLibraryAudios(audios);
      if (audios.length === 0) {
        toast.info("자료실에 녹음 파일이 없어요 — 먼저 자료실에 업로드하거나 채팅에서 녹음해보세요");
      }
    } catch (err: any) {
      toast.error("자료실 불러오기 실패: " + (err.message || err));
    } finally {
      setLibraryLoading(false);
    }
  }

  /* ── Audio file upload ─── */
  async function handleAudioUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith("audio/") && !file.name.match(/\.(mp3|wav|m4a|ogg|webm|aac|flac)$/i)) {
      toast.error("오디오 파일만 업로드할 수 있습니다");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("로그인이 필요합니다"); setUploading(false); return; }

    const filePath = `meetings/${meetingId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("media").upload(filePath, file);
    if (uploadError) {
      toast.error("업로드 실패: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(filePath);
    setAudioUrl(publicUrl);
    setAudioFile(file);

    // Register in file_attachments so it appears in 자료실
    try {
      const { data: mtg } = await supabase.from("meetings").select("group_id, title").eq("id", meetingId).single();
      if (mtg?.group_id) {
        await supabase.from("file_attachments").insert({
          target_type: "group",
          target_id: mtg.group_id,
          uploaded_by: user.id,
          file_name: `[녹음] ${mtg.title || "미팅"} - ${file.name}`,
          file_url: publicUrl,
          file_type: file.type || "audio/mpeg",
          file_size: file.size,
        });
      }
    } catch { /* non-critical */ }

    toast.success(`"${file.name}" 업로드 완료`);
    setUploading(false);
  }

  /* ── AI Processing (Gemini 2.0 Flash) ─── */
  async function handleAiProcess() {
    if (!rawNotes.trim() && !audioFile && !audioUrl) {
      toast.error("회의 내용을 입력하거나 녹음 파일을 업로드해주세요");
      return;
    }

    setProcessing(true);

    try {
      // Build request body
      const body: Record<string, any> = {
        notes: rawNotes.trim() || null,
        agendas,
        meetingTitle,
        previousDigest: previousDigest || null,
      };

      // If audio file exists: Vercel 4.5MB body 제한 우회를 위해 R2 로 먼저 업로드 → URL 만 서버에 전달
      if (audioFile) {
        const SMALL_LIMIT = 3 * 1024 * 1024; // 3MB 미만만 base64 인라인 시도 (여유 있게)
        if (audioFile.size < SMALL_LIMIT) {
          const base64 = await fileToBase64(audioFile);
          body.audioBase64 = base64;
          body.audioMimeType = audioFile.type || "audio/mpeg";
        } else {
          // 큰 파일 → R2 업로드 후 URL 전달 (서버가 Gemini Files API 로 재업로드)
          const { uploadFile } = await import("@/lib/storage/upload-client");
          toast.loading("녹음 파일 업로드 중...", { id: "audio-upload" });
          try {
            const up = await uploadFile(audioFile, { prefix: "resources" });
            toast.success("업로드 완료 — AI 요약 시작", { id: "audio-upload" });
            body.audioUrl = up.url;
            body.audioMimeType = audioFile.type || "audio/mpeg";
          } catch (uploadErr: any) {
            toast.error(`업로드 실패: ${uploadErr.message || uploadErr}`, { id: "audio-upload" });
            throw uploadErr;
          }
        }
      } else if (audioUrl) {
        // 자료실/Drive 에서 선택한 URL — 서버가 다운로드해서 Gemini 에 전달
        body.audioUrl = audioUrl;
        // mime 추정 (파일명 확장자 기반)
        const name = audioUrl.toLowerCase();
        if (name.match(/\.mp3(\?|$)/)) body.audioMimeType = "audio/mpeg";
        else if (name.match(/\.wav(\?|$)/)) body.audioMimeType = "audio/wav";
        else if (name.match(/\.m4a(\?|$)/)) body.audioMimeType = "audio/mp4";
        else if (name.match(/\.ogg(\?|$)/)) body.audioMimeType = "audio/ogg";
        else if (name.match(/\.flac(\?|$)/)) body.audioMimeType = "audio/flac";
        else if (name.match(/\.aac(\?|$)/)) body.audioMimeType = "audio/aac";
        else body.audioMimeType = "audio/webm"; // 채팅 녹음 기본
      }

      const res = await fetch("/api/ai/meeting-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `API 오류 (${res.status})`);
      }

      const result: AiResult = await res.json();
      setAiResult(result);
      setEditedSummary(result.summary);
      toast.success("AI 정리가 완료되었습니다");
    } catch (err: unknown) {
    const __err = err as { message?: string; code?: number; name?: string };
      console.error("AI processing error:", err);
      toast.error(__err.message || "AI 처리 중 오류가 발생했습니다");
    } finally {
      setProcessing(false);
    }
  }

  /* ── Save results ─── */
  async function handleSaveAll() {
    if (!aiResult) return;
    setSaving(true);

    try {
      // Save summary
      const finalSummary = editingResult ? editedSummary : aiResult.summary;
      await onSaveSummary?.(finalSummary);

      // Batch save all notes in parallel (decisions + action items)
      const notePromises: Promise<void>[] = [];

      // Decisions
      for (const decision of aiResult.decisions) {
        if (onAddNote) notePromises.push(onAddNote(decision, "decision") as Promise<void>);
      }

      // Action items
      for (const item of aiResult.actionItems) {
        const content = item.assignee ? `${item.task} (@${item.assignee})` : item.task;
        if (onAddNote) {
          notePromises.push(
            onAddNote(content, "action_item", {
              dueDate: item.dueDate ?? null,
              priority: item.priority ?? null,
              assignee: item.assignee ?? null,
            }) as Promise<void>
          );
        }
      }

      // Execute all note saves in parallel
      if (notePromises.length > 0) {
        await Promise.all(notePromises);
      }

      // Save next topic + archive in parallel
      const followupPromises: Promise<any>[] = [];

      if (aiResult.nextTopics.length > 0 && onSaveNextTopic) {
        followupPromises.push(Promise.resolve(onSaveNextTopic(aiResult.nextTopics.join("\n"))));
      }

      if (onArchiveToGoogleDoc) {
        const docTitle = `회의록 - ${meetingTitle} (${new Date().toLocaleDateString("ko-KR")})`;
        const docContent = formatMeetingAsDoc(aiResult, finalSummary);
        followupPromises.push(
          onArchiveToGoogleDoc(docTitle, docContent).then(archiveResult => {
            if (archiveResult?.url) toast.success("Google Docs에 아카이브되었습니다");
            else if (archiveResult?.error) toast.error(archiveResult.error);
          })
        );
      }

      if (followupPromises.length > 0) {
        await Promise.all(followupPromises);
      }

      toast.success("회의록이 저장되었습니다");
      setSaved(true);
    } catch (err) {
      console.error("Save error:", err);
      toast.error("저장 중 오류가 발생했습니다");
    }
    setSaving(false);
  }

  /* ── Format meeting as doc content ─── */
  function formatMeetingAsDoc(result: AiResult, summary: string) {
    const r = result as any;
    const discussions = result.discussions ?? [];
    const decisions = result.decisions ?? [];
    const actionItems = result.actionItems ?? [];
    const nextTopics = result.nextTopics ?? [];
    const topics = result.topics ?? [];
    const quotes = result.quotes ?? [];
    const speakers = result.speakers ?? [];
    const openQuestions = result.openQuestions ?? [];
    const transcript = result.transcript ?? [];
    const overview = result.overview;

    let doc = `# 회의록: ${meetingTitle}\n`;
    doc += `**날짜:** ${overview?.date || new Date().toLocaleDateString("ko-KR")}\n`;
    if (overview?.durationMin) doc += `**길이:** ${overview.durationMin}분\n`;
    if ((overview?.attendees ?? []).length) doc += `**참석자:** ${overview!.attendees!.join(", ")}\n`;
    doc += `\n## 개요\n${overview?.gist || summary}\n\n`;

    if (topics.length > 0) {
      doc += `## 주제별 논의\n`;
      topics.forEach((t) => {
        doc += `\n### ${t.title}\n`;
        (t.points ?? []).forEach((p) => (doc += `- ${p}\n`));
        (t.quotes ?? []).forEach((q) => {
          const ts = q.timestamp ? `\`[${q.timestamp}]\` ` : "";
          doc += `> ${ts}**${q.speaker}:** ${q.text}\n`;
        });
      });
      doc += `\n`;
    } else if (discussions.length > 0) {
      doc += `## 논의 사항\n${discussions.map((d) => `- ${d}`).join("\n")}\n\n`;
    }
    if (decisions.length > 0) {
      doc += `## 결정 사항\n${decisions.map((d) => `> ✅ ${d}`).join("\n")}\n\n`;
    }
    if (actionItems.length > 0) {
      doc += `## 액션 아이템\n\n| 담당자 | 할 일 | 마감 | 우선순위 |\n| --- | --- | --- | --- |\n`;
      actionItems.forEach((a) => {
        const pr = a.priority === "high" ? "🔴 높음" : a.priority === "low" ? "🟢 낮음" : "🟡 보통";
        doc += `| ${a.assignee || "-"} | ${(a.task || "").replace(/\|/g, "\\|")} | ${a.dueDate || "-"} | ${pr} |\n`;
      });
      doc += `\n`;
    }
    if (quotes.length > 0) {
      doc += `## 주요 발언\n`;
      quotes.forEach((q) => {
        const ts = q.timestamp ? `\`[${q.timestamp}]\` ` : "";
        doc += `> ${ts}**${q.speaker}:** ${q.text}\n\n`;
      });
    }
    if (speakers.length > 0) {
      doc += `## 참여자별 요약\n${speakers.map((s) => `- **${s.label}** — ${s.summary}`).join("\n")}\n\n`;
    }
    if (openQuestions.length > 0) {
      doc += `## 후속 질문\n${openQuestions.map((q) => `- ❓ ${q}`).join("\n")}\n\n`;
    }
    if (nextTopics.length > 0) {
      doc += `## 다음 미팅 주제\n${nextTopics.map((t) => `- ${t}`).join("\n")}\n\n`;
    }
    // Growth sections
    if (r.growthInsights?.length > 0) {
      doc += `## 🌱 성장 인사이트\n${r.growthInsights.map((g: string) => `- ${g}`).join("\n")}\n\n`;
    }
    if (r.learningRecommendations?.length > 0) {
      doc += `## 📚 학습 추천\n${r.learningRecommendations.map((l: string) => `- ${l}`).join("\n")}\n\n`;
    }
    if (r.discussionQuality) {
      doc += `## 📊 토론 품질\n- 깊이: ${r.discussionQuality.depth}\n- 참여도: ${r.discussionQuality.participation}\n- 실행성: ${r.discussionQuality.actionability}\n\n`;
    }
    if (transcript.length > 0) {
      doc += `<details>\n<summary>📝 전체 트랜스크립트 (${transcript.length}개 발화)</summary>\n\n`;
      transcript.forEach((line) => {
        const ts = line.timestamp ? `\`[${line.timestamp}]\` ` : "";
        doc += `${ts}**${line.speaker}:** ${line.text}\n\n`;
      });
      doc += `</details>\n\n`;
    }
    doc += `---\n*NutUnion AI 성장 촉진자에 의해 자동 생성됨*\n`;
    return doc;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header ─── */}
      <div className="bg-nu-ink text-nu-paper p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12">
          <Sparkles size={80} />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} className="text-nu-pink" />
          <span className="font-mono-nu text-[12px] font-black uppercase tracking-[0.2em] text-nu-pink">
            AI_Meeting_Assistant
          </span>
        </div>
        <p className="text-[12px] text-nu-paper/70 leading-relaxed">
          회의 내용을 입력하거나 녹음 파일을 업로드하면 AI가 자동으로 정리합니다.
          요약, 논의사항, 결정사항, 액션아이템, 다음 미팅 주제를 생성합니다.
        </p>
      </div>

      {/* ── Previous Digest Context Banner ─── */}
      {previousDigest && (
        <div className="bg-purple-50 border-[2px] border-purple-300 p-4 flex items-start gap-3">
          <Zap size={16} className="text-purple-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-mono-nu text-[11px] font-bold uppercase tracking-widest text-purple-700 mb-1">
              📌 이전 주간 다이제스트 컨텍스트 로드됨
            </p>
            <p className="text-[13px] text-purple-800/80 leading-relaxed">
              {previousDigest}
            </p>
            <p className="font-mono-nu text-[9px] text-purple-400 mt-1.5 uppercase tracking-widest">
              AI가 이 컨텍스트를 기반으로 분석합니다 · 과거 내용을 다시 입력할 필요 없음
            </p>
          </div>
        </div>
      )}

      {/* ── Raw Notes Input ─── */}
      <div className="bg-nu-white border border-nu-ink/[0.08]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-nu-ink/[0.06]">
          <div className="flex items-center gap-2">
            <MessageSquare size={14} className="text-nu-blue" />
            <span className="font-mono-nu text-[12px] font-bold uppercase tracking-widest text-nu-ink">회의 내용 기록</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowAudioInput(!showAudioInput)}
              className={`flex items-center gap-1 px-2.5 py-1 font-mono-nu text-[11px] uppercase tracking-widest border transition-colors ${
                showAudioInput || audioUrl
                  ? "bg-nu-pink/10 text-nu-pink border-nu-pink/30"
                  : "text-nu-muted border-nu-ink/10 hover:text-nu-pink hover:border-nu-pink/20"
              }`}
            >
              <Mic size={11} /> 녹음파일
            </button>
          </div>
        </div>

        <textarea
          value={rawNotes}
          onChange={(e) => setRawNotes(e.target.value)}
          placeholder={`회의 내용을 자유롭게 기록하세요...

💡 팁: 다음 형식을 사용하면 AI가 더 정확하게 분류합니다:
• [결정] 결정된 내용
• [액션] 할일 @담당자
• 그 외 내용은 논의사항으로 분류됩니다`}
          rows={10}
          className="w-full p-4 text-sm leading-relaxed text-nu-ink bg-transparent border-0 focus:outline-none resize-none"
          disabled={!canEdit}
        />

        {/* Audio Upload Area */}
        {showAudioInput && (
          <div className="border-t border-nu-ink/[0.06] p-4 bg-nu-cream/20">
            <div className="flex items-center gap-2 mb-3">
              <FileAudio size={14} className="text-nu-amber" />
              <span className="font-mono-nu text-[11px] font-bold uppercase tracking-widest text-nu-ink">녹음 파일 / 드라이브 링크</span>
            </div>

            <div className="flex flex-col gap-3">
              {/* File upload */}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.aac,.flac"
                  className="hidden"
                  onChange={handleAudioUpload}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-3 py-2 font-mono-nu text-[11px] uppercase tracking-widest bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors disabled:opacity-50"
                >
                  {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  파일 업로드
                </button>
                <span className="text-[12px] text-nu-muted">mp3, wav, m4a, ogg, webm</span>
              </div>

              {/* Google Drive link */}
              <div className="flex items-center gap-2">
                <Link2 size={14} className="text-green-600 shrink-0" />
                <input
                  type="url"
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  placeholder="Google Drive 녹음 파일 링크를 붙여넣기..."
                  className="flex-1 px-3 py-2 text-sm border border-nu-ink/10 bg-transparent focus:outline-none focus:border-nu-pink"
                />
              </div>

              {/* 자료실에서 선택 */}
              {(groupId || projectId) && (
                <div>
                  <button
                    onClick={() => {
                      setShowLibrary(true);
                      if (libraryAudios.length === 0) loadLibraryAudios();
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 font-mono-nu text-[11px] uppercase tracking-widest border-[1.5px] border-nu-ink/20 bg-nu-cream/30 text-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-colors"
                  >
                    📁 자료실에서 선택
                  </button>
                </div>
              )}

              {/* 자료실 picker 모달 */}
              {showLibrary && (
                <div
                  className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4"
                  onClick={() => setShowLibrary(false)}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white w-full max-w-lg max-h-[80vh] border-[2px] border-nu-ink flex flex-col overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b-[2px] border-nu-ink flex items-center justify-between bg-nu-cream/30 shrink-0">
                      <div>
                        <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">자료실 녹음</p>
                        <h3 className="font-head text-[15px] font-extrabold text-nu-ink">녹음 파일 선택</h3>
                      </div>
                      <button
                        onClick={() => setShowLibrary(false)}
                        className="p-1.5 text-nu-muted hover:text-nu-ink"
                        aria-label="닫기"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-auto">
                      {libraryLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 size={20} className="animate-spin text-nu-pink" />
                        </div>
                      ) : libraryAudios.length === 0 ? (
                        <div className="p-8 text-center">
                          <FileAudio size={28} className="mx-auto mb-2 text-nu-muted/40" />
                          <p className="text-[13px] text-nu-graphite">자료실에 녹음 파일이 없어요</p>
                          <p className="text-[11px] text-nu-muted mt-1">
                            자료실에 .mp3, .wav, .m4a 등의 오디오 파일을 업로드하거나
                            <br />
                            채팅창에서 녹음하면 여기서 바로 선택할 수 있어요
                          </p>
                        </div>
                      ) : (
                        <ul className="divide-y divide-nu-ink/5">
                          {libraryAudios.map((a) => (
                            <li key={a.id}>
                              <button
                                onClick={() => {
                                  setAudioUrl(a.url);
                                  setShowLibrary(false);
                                  toast.success(`"${a.name}" 선택됨`);
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-nu-cream/30 flex items-center gap-3 transition-colors"
                              >
                                <FileAudio size={18} className="text-nu-amber shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-semibold text-nu-ink truncate">
                                    {a.name}
                                  </p>
                                  <p className="font-mono-nu text-[10px] text-nu-muted tabular-nums">
                                    {(a.size / 1024 / 1024).toFixed(1)} MB ·{" "}
                                    {new Date(a.uploaded_at).toLocaleDateString("ko-KR", {
                                      month: "numeric",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      timeZone: "Asia/Seoul",
                                    })}
                                  </p>
                                </div>
                                <span className="font-mono-nu text-[10px] uppercase text-nu-pink">선택 →</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {audioUrl && (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200">
                  <CheckCircle2 size={14} className="text-green-600" />
                  <span className="text-[13px] text-green-700 truncate flex-1">{audioUrl}</span>
                  <button onClick={() => { setAudioUrl(""); setAudioFile(null); }} className="text-green-400 hover:text-red-500">
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Process Button + Save Notes */}
        {canEdit && (
          <div className="border-t border-nu-ink/[0.06] p-4 flex items-center justify-between bg-nu-cream/10">
            <div className="flex items-center gap-1.5">
              <p className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest">
                {rawNotes.trim().split(/\s+/).filter(Boolean).length} words
              </p>
              {draftSaved && rawNotes.trim() && (
                <span className="px-1.5 py-0.5 bg-green-100 text-green-600 font-mono-nu text-[9px] uppercase tracking-widest flex items-center gap-0.5">
                  <CheckCircle2 size={8} /> saved
                </span>
              )}
              {previousDigest && (
                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 font-mono-nu text-[9px] uppercase tracking-widest">
                  ⚡ digest
                </span>
              )}
              {audioUrl && (
                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 font-mono-nu text-[9px] uppercase tracking-widest">
                  🎤 audio
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Save raw notes as meeting_notes */}
              <button
                onClick={async () => {
                  if (!rawNotes.trim()) { toast.error("저장할 내용이 없습니다"); return; }
                  try {
                    await onAddNote?.(rawNotes.trim(), "note");
                    toast.success("회의 메모가 저장되었습니다");
                  } catch (err) {
                    console.error("메모 저장 오류:", err);
                    toast.error("메모 저장에 실패했습니다");
                  }
                }}
                disabled={!rawNotes.trim()}
                className="flex items-center gap-1.5 px-3 py-2 font-mono-nu text-[12px] font-bold uppercase tracking-widest bg-nu-ink text-nu-paper hover:bg-nu-graphite disabled:opacity-40 transition-all"
              >
                <Save size={12} /> 메모 저장
              </button>
              <button
                onClick={handleAiProcess}
                disabled={processing || (!rawNotes.trim() && !audioUrl)}
                title="⌘+Enter 또는 Ctrl+Enter"
                className="flex items-center gap-2 px-4 py-2 font-mono-nu text-[12px] font-bold uppercase tracking-widest bg-gradient-to-r from-nu-pink to-purple-500 text-white hover:opacity-90 disabled:opacity-40 transition-all"
              >
                {processing ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> AI 분석 중...
                  </>
                ) : (
                  <>
                    <Sparkles size={13} /> AI 정리하기
                    <kbd className="ml-1 px-1 py-0.5 bg-white/20 text-[9px] rounded">⌘↵</kbd>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── AI Processing Animation ─── */}
      {processing && (
        <div className="bg-nu-ink text-white p-6 border-[2px] border-nu-ink animate-in fade-in duration-300">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 size={20} className="animate-spin text-nu-pink" />
            <span className="font-mono-nu text-[12px] font-bold uppercase tracking-widest text-nu-pink">
              Gemini 2.5 Flash 분석 중
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[13px] text-green-400">
              <CheckCircle2 size={11} /> 회의 내용 전송
            </div>
            {previousDigest && (
              <div className="flex items-center gap-2 text-[13px] text-purple-400">
                <Zap size={11} /> 이전 다이제스트 컨텍스트 주입
              </div>
            )}
            {audioFile && (
              <div className="flex items-center gap-2 text-[13px] text-amber-400">
                <Mic size={11} /> 녹음 파일 분석
              </div>
            )}
            <div className="flex items-center gap-2 text-[13px] text-white/40 animate-pulse">
              <div className="w-1.5 h-1.5 rounded-full bg-nu-pink animate-ping" />
              AI 회의록 생성 중...
            </div>
          </div>
        </div>
      )}

      {/* ── AI Results ─── */}
      {aiResult && (
        <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* ── Plaud-style 메타데이터 strip ─── */}
          {(aiResult.overview || aiResult.summary) && (
            <div className="bg-nu-cream/40 border-[3px] border-nu-ink p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-nu-pink" />
                <span className="font-mono-nu text-[11px] font-black uppercase tracking-[0.2em] text-nu-ink">
                  Meeting Record
                </span>
              </div>
              {/* chips */}
              <div className="flex items-center gap-1.5 flex-wrap mb-3">
                {aiResult.overview?.date && (
                  <span className="px-2 py-0.5 bg-nu-ink text-nu-paper font-mono-nu text-[10px] uppercase tracking-widest">
                    📅 {aiResult.overview.date}
                  </span>
                )}
                {aiResult.overview?.durationMin ? (
                  <span className="px-2 py-0.5 bg-nu-ink text-nu-paper font-mono-nu text-[10px] uppercase tracking-widest">
                    ⏱ {aiResult.overview.durationMin}분
                  </span>
                ) : null}
                {(aiResult.overview?.attendees ?? []).map((a, i) => (
                  <span key={i} className="px-2 py-0.5 bg-nu-pink/20 text-nu-pink font-mono-nu text-[10px] uppercase tracking-widest border border-nu-pink/40">
                    👤 {a}
                  </span>
                ))}
              </div>
              {/* gist */}
              <p className="text-sm leading-relaxed text-nu-graphite">
                {aiResult.overview?.gist || aiResult.summary}
              </p>
            </div>
          )}

          {/* Summary (편집 가능) */}
          <ResultSection
            title="회의 요약"
            icon={<Target size={14} className="text-nu-pink" />}
            expanded={expandedSections.summary}
            onToggle={() => toggleSection("summary")}
          >
            {editingResult ? (
              <textarea
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
                rows={4}
                className="w-full p-3 text-sm leading-relaxed text-nu-ink bg-nu-cream/20 border border-nu-ink/10 focus:outline-none focus:border-nu-pink resize-none"
              />
            ) : (
              <p className="text-sm leading-relaxed text-nu-graphite">{aiResult.summary}</p>
            )}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => setEditingResult(!editingResult)}
                className="flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted hover:text-nu-pink"
              >
                <Edit3 size={10} /> {editingResult ? "미리보기" : "수정"}
              </button>
            </div>
          </ResultSection>

          {/* ── 주제별 논의 (Plaud-style topic groups) ─── */}
          {(aiResult.topics ?? []).length > 0 ? (
            <ResultSection
              title={`주제별 논의 (${aiResult.topics!.length})`}
              icon={<MessageSquare size={14} className="text-nu-blue" />}
              expanded={expandedSections.discussions}
              onToggle={() => toggleSection("discussions")}
            >
              <div className="flex flex-col gap-4">
                {aiResult.topics!.map((topic, ti) => (
                  <div key={ti} className="border-l-4 border-nu-blue/40 pl-3">
                    <h4 className="font-head text-[14px] font-extrabold text-nu-ink mb-1.5">{topic.title}</h4>
                    <ul className="flex flex-col gap-1 mb-2">
                      {(topic.points ?? []).map((p, pi) => (
                        <li key={pi} className="flex items-start gap-2 text-sm text-nu-graphite">
                          <span className="text-nu-blue mt-0.5 shrink-0">•</span>
                          <span className="leading-relaxed">{p}</span>
                        </li>
                      ))}
                    </ul>
                    {(topic.quotes ?? []).map((q, qi) => (
                      <blockquote
                        key={qi}
                        className="border-l-4 border-nu-pink/40 pl-3 py-1 my-1.5 bg-nu-pink/5"
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="px-1.5 py-0.5 bg-nu-pink/20 text-nu-pink font-mono-nu text-[9px] uppercase tracking-widest">
                            {q.speaker}
                          </span>
                          {q.timestamp && (
                            <span className="font-mono-nu text-[9px] text-nu-muted tabular-nums">
                              [{q.timestamp}]
                            </span>
                          )}
                        </div>
                        <p className="text-[13px] text-nu-ink italic leading-relaxed">"{q.text}"</p>
                      </blockquote>
                    ))}
                  </div>
                ))}
              </div>
            </ResultSection>
          ) : (
            /* 구버전 호환: topics 없으면 평탄한 discussions */
            <ResultSection
              title={`논의 사항 (${aiResult.discussions.length})`}
              icon={<MessageSquare size={14} className="text-nu-blue" />}
              expanded={expandedSections.discussions}
              onToggle={() => toggleSection("discussions")}
            >
              <div className="flex flex-col gap-1.5">
                {aiResult.discussions.map((d, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-nu-graphite">
                    <span className="text-nu-blue mt-0.5 shrink-0">•</span>
                    <span className="leading-relaxed">{d}</span>
                  </div>
                ))}
              </div>
            </ResultSection>
          )}

          {/* Decisions */}
          {aiResult.decisions.length > 0 && (
            <ResultSection
              title={`결정 사항 (${aiResult.decisions.length})`}
              icon={<CheckCircle2 size={14} className="text-green-600" />}
              expanded={expandedSections.decisions}
              onToggle={() => toggleSection("decisions")}
            >
              <div className="flex flex-col gap-1.5">
                {aiResult.decisions.map((d, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-nu-graphite">
                    <CheckCircle2 size={13} className="text-green-500 mt-0.5 shrink-0" />
                    <span className="leading-relaxed">{d}</span>
                  </div>
                ))}
              </div>
            </ResultSection>
          )}

          {/* Action Items — Plaud-style table */}
          {aiResult.actionItems.length > 0 && (
            <ResultSection
              title={`액션 아이템 (${aiResult.actionItems.length})`}
              icon={<ListChecks size={14} className="text-nu-amber" />}
              expanded={expandedSections.actions}
              onToggle={() => toggleSection("actions")}
            >
              <div className="overflow-x-auto border-[2px] border-nu-ink/20">
                <table className="w-full text-[13px]">
                  <thead className="bg-nu-cream/40 border-b-[2px] border-nu-ink/20">
                    <tr>
                      <th className="px-2 py-2 text-left w-8"></th>
                      <th className="px-2 py-2 text-left font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">담당자</th>
                      <th className="px-2 py-2 text-left font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">할 일</th>
                      <th className="px-2 py-2 text-left font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">마감</th>
                      <th className="px-2 py-2 text-left font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">우선순위</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiResult.actionItems.map((item, i) => {
                      const pr = item.priority || "normal";
                      const prStyle =
                        pr === "high"
                          ? "bg-red-100 text-red-700 border-red-300"
                          : pr === "low"
                          ? "bg-green-100 text-green-700 border-green-300"
                          : "bg-amber-100 text-amber-700 border-amber-300";
                      const prLabel = pr === "high" ? "🔴 높음" : pr === "low" ? "🟢 낮음" : "🟡 보통";
                      return (
                        <tr key={i} className="border-t border-nu-ink/10 hover:bg-nu-cream/20">
                          <td className="px-2 py-2 align-top">
                            <input type="checkbox" className="mt-0.5" disabled />
                          </td>
                          <td className="px-2 py-2 align-top">
                            {item.assignee ? (
                              <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-pink bg-nu-pink/10 px-1.5 py-0.5">
                                @{item.assignee}
                              </span>
                            ) : (
                              <span className="text-nu-muted">-</span>
                            )}
                          </td>
                          <td className="px-2 py-2 align-top text-nu-ink leading-snug">{item.task}</td>
                          <td className="px-2 py-2 align-top font-mono-nu text-[11px] tabular-nums text-nu-graphite whitespace-nowrap">
                            {item.dueDate || "-"}
                          </td>
                          <td className="px-2 py-2 align-top">
                            <span className={`font-mono-nu text-[10px] uppercase tracking-widest px-1.5 py-0.5 border ${prStyle}`}>
                              {prLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </ResultSection>
          )}

          {/* ── 주요 발언 (verbatim quote highlights) ─── */}
          {(aiResult.quotes ?? []).length > 0 && (
            <ResultSection
              title={`주요 발언 (${aiResult.quotes!.length})`}
              icon={<MessageSquare size={14} className="text-nu-pink" />}
              expanded={expandedSections.quotes ?? true}
              onToggle={() => toggleSection("quotes")}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {aiResult.quotes!.map((q, i) => (
                  <div
                    key={i}
                    className="border-l-4 border-nu-pink/40 pl-3 pr-2 py-2 bg-nu-pink/5"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-1.5 py-0.5 bg-nu-pink/20 text-nu-pink font-mono-nu text-[9px] uppercase tracking-widest">
                        {q.speaker}
                      </span>
                      {q.timestamp && (
                        <span className="font-mono-nu text-[9px] text-nu-muted tabular-nums">
                          [{q.timestamp}]
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-nu-ink italic leading-relaxed">"{q.text}"</p>
                  </div>
                ))}
              </div>
            </ResultSection>
          )}

          {/* ── 참여자별 요약 ─── */}
          {(aiResult.speakers ?? []).length > 0 && (
            <ResultSection
              title={`참여자별 요약 (${aiResult.speakers!.length})`}
              icon={<MessageSquare size={14} className="text-nu-blue" />}
              expanded={expandedSections.speakers ?? true}
              onToggle={() => toggleSection("speakers")}
            >
              <div className="flex flex-col gap-2">
                {aiResult.speakers!.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <span className="px-2 py-0.5 bg-nu-ink text-nu-paper font-mono-nu text-[10px] uppercase tracking-widest shrink-0">
                      {s.label}
                    </span>
                    <span className="text-nu-graphite leading-relaxed">{s.summary}</span>
                  </div>
                ))}
              </div>
            </ResultSection>
          )}

          {/* ── 후속 질문 ─── */}
          {(aiResult.openQuestions ?? []).length > 0 && (
            <ResultSection
              title={`후속 질문 (${aiResult.openQuestions!.length})`}
              icon={<Lightbulb size={14} className="text-amber-500" />}
              expanded={expandedSections.openQuestions ?? true}
              onToggle={() => toggleSection("openQuestions")}
            >
              <div className="flex flex-col gap-1.5">
                {aiResult.openQuestions!.map((q, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-nu-graphite">
                    <span className="text-amber-500 mt-0.5 shrink-0">❓</span>
                    <span className="leading-relaxed">{q}</span>
                  </div>
                ))}
              </div>
            </ResultSection>
          )}

          {/* Next Meeting Topics */}
          <ResultSection
            title={`다음 미팅 주제 제안 (${aiResult.nextTopics.length})`}
            icon={<Lightbulb size={14} className="text-purple-500" />}
            expanded={expandedSections.nextTopics}
            onToggle={() => toggleSection("nextTopics")}
          >
            <div className="flex flex-col gap-1.5">
              {aiResult.nextTopics.map((t, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-nu-graphite">
                  <ArrowRight size={13} className="text-purple-400 mt-0.5 shrink-0" />
                  <span className="leading-relaxed">{t}</span>
                </div>
              ))}
            </div>
          </ResultSection>

          {/* Growth Insights */}
          {(aiResult as any).growthInsights?.length > 0 && (
            <ResultSection
              title={`성장 인사이트 (${(aiResult as any).growthInsights.length})`}
              icon={<TrendingUp size={14} className="text-green-500" />}
              expanded={expandedSections.growth}
              onToggle={() => toggleSection("growth")}
            >
              <div className="flex flex-col gap-2">
                {(aiResult as any).growthInsights.map((g: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-nu-graphite p-2 bg-green-50 border border-green-100">
                    <Heart size={13} className="text-green-500 mt-0.5 shrink-0" />
                    <span className="leading-relaxed">{g}</span>
                  </div>
                ))}
              </div>
            </ResultSection>
          )}

          {/* Learning Recommendations */}
          {(aiResult as any).learningRecommendations?.length > 0 && (
            <ResultSection
              title={`학습 추천 (${(aiResult as any).learningRecommendations.length})`}
              icon={<BookOpen size={14} className="text-blue-500" />}
              expanded={expandedSections.learning}
              onToggle={() => toggleSection("learning")}
            >
              <div className="flex flex-col gap-1.5">
                {(aiResult as any).learningRecommendations.map((l: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-nu-graphite">
                    <BookOpen size={13} className="text-blue-400 mt-0.5 shrink-0" />
                    <span className="leading-relaxed">{l}</span>
                  </div>
                ))}
              </div>
            </ResultSection>
          )}

          {/* Discussion Quality */}
          {(aiResult as any).discussionQuality && (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-purple-500" />
                <span className="font-mono-nu text-[12px] font-bold uppercase tracking-widest text-purple-700">토론 품질 분석</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "논의 깊이", value: (aiResult as any).discussionQuality.depth, color: "text-purple-600" },
                  { label: "참여도", value: (aiResult as any).discussionQuality.participation, color: "text-blue-600" },
                  { label: "실행 가능성", value: (aiResult as any).discussionQuality.actionability, color: "text-green-600" },
                ].map((q, i) => (
                  <div key={i} className="text-center">
                    <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1">{q.label}</p>
                    <p className={`text-[13px] font-semibold ${q.color}`}>{q.value || "-"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save All / Regenerate */}
          <div className="p-4 bg-nu-ink text-nu-paper space-y-3">
            {/* Context indicator */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-paper/30">AI 입력:</span>
              <span className="px-1.5 py-0.5 bg-nu-paper/10 text-nu-paper/50 font-mono-nu text-[9px] uppercase tracking-widest">텍스트</span>
              {previousDigest && (
                <span className="px-1.5 py-0.5 bg-purple-500/30 text-purple-300 font-mono-nu text-[9px] uppercase tracking-widest">⚡ 다이제스트</span>
              )}
              {agendas.length > 0 && (
                <span className="px-1.5 py-0.5 bg-nu-paper/10 text-nu-paper/50 font-mono-nu text-[9px] uppercase tracking-widest">{agendas.length}개 안건</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={handleAiProcess}
                disabled={processing}
                className="flex items-center gap-1.5 font-mono-nu text-[11px] uppercase tracking-widest text-nu-paper/60 hover:text-nu-paper transition-colors"
              >
                <RefreshCw size={12} /> 다시 분석
              </button>
              <button
                onClick={async () => {
                  try {
                    const now = new Date();
                    const r = aiResult as any;
                    const text = [
                      `# ${meetingTitle}`,
                      `> ${now.toLocaleDateString("ko-KR")}`,
                      "",
                      `## 요약`,
                      aiResult.summary,
                      "",
                      `## 논의 사항`,
                      ...aiResult.discussions.map(d => `- ${d}`),
                      "",
                      ...(aiResult.decisions.length > 0 ? [`## 결정 사항`, ...aiResult.decisions.map(d => `- ${d}`), ""] : []),
                      ...(aiResult.actionItems.length > 0 ? [`## 액션 아이템`, ...aiResult.actionItems.map(a => `- [ ] ${a.task}${a.assignee ? ` @${a.assignee}` : ""}`), ""] : []),
                      ...(aiResult.nextTopics.length > 0 ? [`## 다음 미팅 주제`, ...aiResult.nextTopics.map(t => `- ${t}`), ""] : []),
                      ...(r.growthInsights?.length > 0 ? [`## 🌱 성장 인사이트`, ...r.growthInsights.map((g: string) => `- ${g}`), ""] : []),
                      ...(r.learningRecommendations?.length > 0 ? [`## 📚 학습 추천`, ...r.learningRecommendations.map((l: string) => `- ${l}`), ""] : []),
                      ...(r.discussionQuality ? [`## 📊 토론 품질`, `- 깊이: ${r.discussionQuality.depth}`, `- 참여도: ${r.discussionQuality.participation}`, `- 실행성: ${r.discussionQuality.actionability}`, ""] : []),
                    ].join("\n");
                    await navigator.clipboard.writeText(text);
                    toast.success("마크다운 형식으로 복사되었습니다");
                  } catch { toast.error("복사 실패"); }
                }}
                className="flex items-center gap-1.5 font-mono-nu text-[11px] uppercase tracking-widest text-nu-paper/60 hover:text-nu-paper transition-colors"
              >
                <Copy size={12} /> MD 복사
              </button>
            </div>
            <button
              onClick={handleSaveAll}
              disabled={saving || saved}
              className={`w-full flex items-center justify-center gap-2 px-5 py-3 font-mono-nu text-[13px] font-bold uppercase tracking-widest transition-all shadow-lg ${
                saved
                  ? "bg-green-600 text-white cursor-default"
                  : "bg-nu-pink text-white hover:bg-nu-pink/90 disabled:opacity-40"
              }`}
            >
              {saving ? (
                <><Loader2 size={14} className="animate-spin" /> 저장 중...</>
              ) : saved ? (
                <><CheckCircle2 size={14} /> 저장 완료</>
              ) : (
                <><Save size={14} /> 회의록 전체 저장{onArchiveToGoogleDoc ? " + Google Docs 아카이브" : ""}</>
              )}
            </button>
            {/* Performance metadata */}
            {(aiResult as any)?._meta && (
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <span className="font-mono-nu text-[9px] text-nu-paper/30 uppercase tracking-widest">
                  {(aiResult as any)._meta.model}
                </span>
                <span className="font-mono-nu text-[9px] text-nu-paper/30 uppercase tracking-widest">
                  {((aiResult as any)._meta.responseTimeMs / 1000).toFixed(1)}s
                </span>
                <span className="font-mono-nu text-[9px] text-nu-paper/30 uppercase tracking-widest">
                  ~{(aiResult as any)._meta.inputTokenEstimate} tokens
                </span>
                {(aiResult as any)._meta.usedDigest && (
                  <span className="font-mono-nu text-[9px] text-purple-400 uppercase tracking-widest">
                    ⚡ digest injected
                  </span>
                )}
              </div>
            )}
            {!saved && (
              <p className="font-mono-nu text-[10px] text-nu-paper/40 uppercase tracking-widest text-center">
                요약·결정사항·액션아이템·다음주제가 모두 저장됩니다
                {onArchiveToGoogleDoc && " · Google Docs에 자동 아카이브"}
              </p>
            )}
            {/* (전체 트랜스크립트는 아래에 collapsible 로 렌더링됨) */}
            {/* Post-save quick navigation */}
            {saved && onNavigateTab && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <span className="font-mono-nu text-[9px] text-nu-paper/40 uppercase tracking-widest">다음 단계 →</span>
                <button
                  onClick={() => onNavigateTab("wiki-sync")}
                  className="px-3 py-1.5 bg-nu-pink/20 text-nu-pink font-mono-nu text-[10px] uppercase tracking-widest hover:bg-nu-pink/30 transition-colors"
                >
                  탭 동기화
                </button>
                <button
                  onClick={() => onNavigateTab("digest")}
                  className="px-3 py-1.5 bg-purple-500/20 text-purple-300 font-mono-nu text-[10px] uppercase tracking-widest hover:bg-purple-500/30 transition-colors"
                >
                  주간 다이제스트
                </button>
              </div>
            )}
          </div>

          {/* ── 전체 트랜스크립트 (collapsible) ─── */}
          {(aiResult.transcript ?? []).length > 0 && (
            <details className="bg-nu-white border-[3px] border-nu-ink/20 group">
              <summary className="cursor-pointer px-4 py-3 flex items-center justify-between hover:bg-nu-cream/30 transition-colors select-none">
                <div className="flex items-center gap-2">
                  <FileAudio size={14} className="text-nu-graphite" />
                  <span className="font-mono-nu text-[12px] font-bold uppercase tracking-widest text-nu-ink">
                    전체 트랜스크립트 ({aiResult.transcript!.length}개 발화)
                  </span>
                </div>
                <ChevronDown size={14} className="text-nu-muted group-open:rotate-180 transition-transform" />
              </summary>
              <div className="border-t border-nu-ink/10 max-h-[480px] overflow-y-auto px-4 py-3 space-y-2">
                {aiResult.transcript!.map((line, i) => (
                  <div key={i} className="flex items-start gap-3 text-[13px] leading-relaxed">
                    <span className="font-mono-nu text-[10px] tabular-nums text-nu-muted shrink-0 pt-0.5 w-[68px]">
                      [{line.timestamp || "--:--:--"}]
                    </span>
                    <span className="font-bold text-nu-ink shrink-0 min-w-[60px]">
                      {line.speaker}:
                    </span>
                    <span className="text-nu-graphite">{line.text}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Result Section ─── */
function ResultSection({
  title,
  icon,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-nu-white border border-nu-ink/[0.08] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-nu-cream/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-mono-nu text-[12px] font-bold uppercase tracking-widest text-nu-ink">{title}</span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-nu-muted" /> : <ChevronDown size={14} className="text-nu-muted" />}
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
