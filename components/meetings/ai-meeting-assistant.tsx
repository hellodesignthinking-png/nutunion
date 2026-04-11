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
  onAddNote?: (content: string, type: "note" | "action_item" | "decision") => void | Promise<void>;
  /** Callback to archive as Google Doc */
  onArchiveToGoogleDoc?: (title: string, content: string) => Promise<{ url?: string; error?: string } | void>;
  /** Callback to navigate to a specific tab */
  onNavigateTab?: (tab: string) => void;
}

interface AiResult {
  summary: string;
  discussions: string[];
  decisions: string[];
  actionItems: { task: string; assignee?: string }[];
  nextTopics: string[];
}

/* ─── Helper: Convert File to Base64 ─── */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:audio/...;base64, prefix
      const base64 = result.split(",")[1];
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
}: AiMeetingAssistantProps) {
  const [rawNotes, setRawNotes] = useState(existingNotes.join("\n") || "");
  const [audioUrl, setAudioUrl] = useState("");
  const [showAudioInput, setShowAudioInput] = useState(false);
  const [processing, setProcessing] = useState(false);
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

      // If audio file exists, convert to base64 for Gemini
      if (audioFile) {
        const base64 = await fileToBase64(audioFile);
        body.audioBase64 = base64;
        body.audioMimeType = audioFile.type || "audio/mpeg";
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
    } catch (err: any) {
      console.error("AI processing error:", err);
      toast.error(err.message || "AI 처리 중 오류가 발생했습니다");
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
        if (onAddNote) notePromises.push(onAddNote(content, "action_item") as Promise<void>);
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
    let doc = `# 회의록: ${meetingTitle}\n`;
    doc += `**날짜:** ${new Date().toLocaleDateString("ko-KR")}\n\n`;
    doc += `## 요약\n${summary}\n\n`;
    if (result.discussions.length > 0) {
      doc += `## 논의 사항\n${result.discussions.map((d) => `- ${d}`).join("\n")}\n\n`;
    }
    if (result.decisions.length > 0) {
      doc += `## 결정 사항\n${result.decisions.map((d) => `- ${d}`).join("\n")}\n\n`;
    }
    if (result.actionItems.length > 0) {
      doc += `## 액션 아이템\n${result.actionItems.map((a) => `- ${a.task}${a.assignee ? ` (담당: ${a.assignee})` : ""}`).join("\n")}\n\n`;
    }
    if (result.nextTopics.length > 0) {
      doc += `## 다음 미팅 주제\n${result.nextTopics.map((t) => `- ${t}`).join("\n")}\n\n`;
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
          <span className="font-mono-nu text-[10px] font-black uppercase tracking-[0.2em] text-nu-pink">
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
            <p className="font-mono-nu text-[9px] font-bold uppercase tracking-widest text-purple-700 mb-1">
              📌 이전 주간 다이제스트 컨텍스트 로드됨
            </p>
            <p className="text-[11px] text-purple-800/80 leading-relaxed">
              {previousDigest}
            </p>
            <p className="font-mono-nu text-[7px] text-purple-400 mt-1.5 uppercase tracking-widest">
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
            <span className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-ink">회의 내용 기록</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowAudioInput(!showAudioInput)}
              className={`flex items-center gap-1 px-2.5 py-1 font-mono-nu text-[9px] uppercase tracking-widest border transition-colors ${
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
• [액션] 할 일 @담당자
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
              <span className="font-mono-nu text-[9px] font-bold uppercase tracking-widest text-nu-ink">녹음 파일 / 드라이브 링크</span>
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
                  className="flex items-center gap-1.5 px-3 py-2 font-mono-nu text-[9px] uppercase tracking-widest bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors disabled:opacity-50"
                >
                  {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  파일 업로드
                </button>
                <span className="text-[10px] text-nu-muted">mp3, wav, m4a, ogg, webm</span>
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

              {audioUrl && (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200">
                  <CheckCircle2 size={14} className="text-green-600" />
                  <span className="text-[11px] text-green-700 truncate flex-1">{audioUrl}</span>
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
              <p className="font-mono-nu text-[8px] text-nu-muted uppercase tracking-widest">
                {rawNotes.trim().split(/\s+/).filter(Boolean).length} words
              </p>
              {draftSaved && rawNotes.trim() && (
                <span className="px-1.5 py-0.5 bg-green-100 text-green-600 font-mono-nu text-[7px] uppercase tracking-widest flex items-center gap-0.5">
                  <CheckCircle2 size={8} /> saved
                </span>
              )}
              {previousDigest && (
                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 font-mono-nu text-[7px] uppercase tracking-widest">
                  ⚡ digest
                </span>
              )}
              {audioUrl && (
                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 font-mono-nu text-[7px] uppercase tracking-widest">
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
                className="flex items-center gap-1.5 px-3 py-2 font-mono-nu text-[10px] font-bold uppercase tracking-widest bg-nu-ink text-nu-paper hover:bg-nu-graphite disabled:opacity-40 transition-all"
              >
                <Save size={12} /> 메모 저장
              </button>
              <button
                onClick={handleAiProcess}
                disabled={processing || (!rawNotes.trim() && !audioUrl)}
                title="⌘+Enter 또는 Ctrl+Enter"
                className="flex items-center gap-2 px-4 py-2 font-mono-nu text-[10px] font-bold uppercase tracking-widest bg-gradient-to-r from-nu-pink to-purple-500 text-white hover:opacity-90 disabled:opacity-40 transition-all"
              >
                {processing ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> AI 분석 중...
                  </>
                ) : (
                  <>
                    <Sparkles size={13} /> AI 정리하기
                    <kbd className="ml-1 px-1 py-0.5 bg-white/20 text-[7px] rounded">⌘↵</kbd>
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
            <span className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-pink">
              Gemini 2.5 Flash 분석 중
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] text-green-400">
              <CheckCircle2 size={11} /> 회의 내용 전송
            </div>
            {previousDigest && (
              <div className="flex items-center gap-2 text-[11px] text-purple-400">
                <Zap size={11} /> 이전 다이제스트 컨텍스트 주입
              </div>
            )}
            {audioFile && (
              <div className="flex items-center gap-2 text-[11px] text-amber-400">
                <Mic size={11} /> 녹음 파일 분석
              </div>
            )}
            <div className="flex items-center gap-2 text-[11px] text-white/40 animate-pulse">
              <div className="w-1.5 h-1.5 rounded-full bg-nu-pink animate-ping" />
              AI 회의록 생성 중...
            </div>
          </div>
        </div>
      )}

      {/* ── AI Results ─── */}
      {aiResult && (
        <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Summary */}
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
                className="flex items-center gap-1 font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted hover:text-nu-pink"
              >
                <Edit3 size={10} /> {editingResult ? "미리보기" : "수정"}
              </button>
            </div>
          </ResultSection>

          {/* Discussions */}
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

          {/* Action Items */}
          {aiResult.actionItems.length > 0 && (
            <ResultSection
              title={`액션 아이템 (${aiResult.actionItems.length})`}
              icon={<ListChecks size={14} className="text-nu-amber" />}
              expanded={expandedSections.actions}
              onToggle={() => toggleSection("actions")}
            >
              <div className="flex flex-col gap-2">
                {aiResult.actionItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-nu-amber/5 border border-nu-amber/10">
                    <ListChecks size={13} className="text-nu-amber mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-nu-ink">{item.task}</span>
                      {item.assignee && (
                        <span className="ml-2 font-mono-nu text-[9px] uppercase tracking-widest text-nu-pink bg-nu-pink/10 px-1.5 py-0.5">
                          @{item.assignee}
                        </span>
                      )}
                    </div>
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
                <span className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-purple-700">토론 품질 분석</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "논의 깊이", value: (aiResult as any).discussionQuality.depth, color: "text-purple-600" },
                  { label: "참여도", value: (aiResult as any).discussionQuality.participation, color: "text-blue-600" },
                  { label: "실행 가능성", value: (aiResult as any).discussionQuality.actionability, color: "text-green-600" },
                ].map((q, i) => (
                  <div key={i} className="text-center">
                    <p className="font-mono-nu text-[7px] uppercase tracking-widest text-nu-muted mb-1">{q.label}</p>
                    <p className={`text-[11px] font-semibold ${q.color}`}>{q.value || "-"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save All / Regenerate */}
          <div className="p-4 bg-nu-ink text-nu-paper space-y-3">
            {/* Context indicator */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono-nu text-[7px] uppercase tracking-widest text-nu-paper/30">AI 입력:</span>
              <span className="px-1.5 py-0.5 bg-nu-paper/10 text-nu-paper/50 font-mono-nu text-[7px] uppercase tracking-widest">텍스트</span>
              {previousDigest && (
                <span className="px-1.5 py-0.5 bg-purple-500/30 text-purple-300 font-mono-nu text-[7px] uppercase tracking-widest">⚡ 다이제스트</span>
              )}
              {agendas.length > 0 && (
                <span className="px-1.5 py-0.5 bg-nu-paper/10 text-nu-paper/50 font-mono-nu text-[7px] uppercase tracking-widest">{agendas.length}개 안건</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={handleAiProcess}
                disabled={processing}
                className="flex items-center gap-1.5 font-mono-nu text-[9px] uppercase tracking-widest text-nu-paper/60 hover:text-nu-paper transition-colors"
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
                className="flex items-center gap-1.5 font-mono-nu text-[9px] uppercase tracking-widest text-nu-paper/60 hover:text-nu-paper transition-colors"
              >
                <Copy size={12} /> MD 복사
              </button>
            </div>
            <button
              onClick={handleSaveAll}
              disabled={saving || saved}
              className={`w-full flex items-center justify-center gap-2 px-5 py-3 font-mono-nu text-[11px] font-bold uppercase tracking-widest transition-all shadow-lg ${
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
                <span className="font-mono-nu text-[7px] text-nu-paper/30 uppercase tracking-widest">
                  {(aiResult as any)._meta.model}
                </span>
                <span className="font-mono-nu text-[7px] text-nu-paper/30 uppercase tracking-widest">
                  {((aiResult as any)._meta.responseTimeMs / 1000).toFixed(1)}s
                </span>
                <span className="font-mono-nu text-[7px] text-nu-paper/30 uppercase tracking-widest">
                  ~{(aiResult as any)._meta.inputTokenEstimate} tokens
                </span>
                {(aiResult as any)._meta.usedDigest && (
                  <span className="font-mono-nu text-[7px] text-purple-400 uppercase tracking-widest">
                    ⚡ digest injected
                  </span>
                )}
              </div>
            )}
            {!saved && (
              <p className="font-mono-nu text-[8px] text-nu-paper/40 uppercase tracking-widest text-center">
                요약·결정사항·액션아이템·다음주제가 모두 저장됩니다
                {onArchiveToGoogleDoc && " · Google Docs에 자동 아카이브"}
              </p>
            )}
            {/* Post-save quick navigation */}
            {saved && onNavigateTab && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <span className="font-mono-nu text-[7px] text-nu-paper/40 uppercase tracking-widest">다음 단계 →</span>
                <button
                  onClick={() => onNavigateTab("wiki-sync")}
                  className="px-3 py-1.5 bg-nu-pink/20 text-nu-pink font-mono-nu text-[8px] uppercase tracking-widest hover:bg-nu-pink/30 transition-colors"
                >
                  위키 동기화
                </button>
                <button
                  onClick={() => onNavigateTab("digest")}
                  className="px-3 py-1.5 bg-purple-500/20 text-purple-300 font-mono-nu text-[8px] uppercase tracking-widest hover:bg-purple-500/30 transition-colors"
                >
                  주간 다이제스트
                </button>
              </div>
            )}
          </div>
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
          <span className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-ink">{title}</span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-nu-muted" /> : <ChevronDown size={14} className="text-nu-muted" />}
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
