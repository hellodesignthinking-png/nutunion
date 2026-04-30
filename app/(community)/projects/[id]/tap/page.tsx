"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  BookOpen, Edit3, Save, Loader2, Globe, Lock, Users, ArrowLeft,
  CheckCircle2, Sparkles, FileEdit, Archive, LayoutDashboard,
  Mic, FileText, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { TapWriterModal } from "@/components/ai/tap-writer-modal";
import { LivingTapEditor } from "@/components/tap/editors/living-tap-editor";
import { DashboardTapEditor } from "@/components/tap/editors/dashboard-tap-editor";
import { TapModeBadge } from "@/components/tap/tap-mode-badge";
import { MeetingRecorder, type MeetingRecorderHandle } from "@/components/meetings/meeting-recorder";
import { AiMeetingAssistant } from "@/components/meetings/ai-meeting-assistant";
import { AiErrorBoundary } from "@/components/shared/ai-error-boundary";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type TapMode = "archive" | "living" | "dashboard";
type Visibility = "public" | "members" | "private";

// Bolt Tap 전용 가짜 meetingId — 녹음 컴포넌트가 meeting 테이블을 직접 조회하지 않도록
// project_resources 테이블에 저장됨 (recorder 내부 로직은 project_id fallback 지원)
function makeBoltMeetingId(projectId: string) {
  return `bolt-tap-${projectId}`;
}

export default function BoltTapPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [tap, setTap] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("members");
  const [aiOpen, setAiOpen] = useState(false);
  const [mode, setMode] = useState<TapMode>("archive");
  const [activeTab, setActiveTab] = useState("tap");
  const [meetingNotes, setMeetingNotes] = useState<string[]>([]);

  // 녹음 ref
  const recorderRef = useRef<MeetingRecorderHandle | null>(null);

  // 가짜 meetingId (볼트 탭 전용)
  const boltMeetingId = makeBoltMeetingId(projectId);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const [projRes, tapRes, memberRes] = await Promise.all([
        supabase.from("projects").select("id, title, status, closure_summary, created_by").eq("id", projectId).maybeSingle(),
        supabase.from("bolt_taps").select("*").eq("project_id", projectId).maybeSingle(),
        user ? supabase.from("project_members").select("id, role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);

      setProject(projRes.data);
      let tapData = tapRes.data;

      // 탭이 없으면 즉시 생성 (구 볼트 대비)
      if (!tapData && projRes.data) {
        const { data: created } = await supabase.from("bolt_taps").insert({
          project_id: projectId,
          title: `${projRes.data.title} — Tap`,
          content_md: "",
          visibility: "members",
        }).select("*").single();
        tapData = created;
      }

      setTap(tapData);
      setContent(tapData?.content_md || "");
      setTitle(tapData?.title || "");
      setVisibility((tapData?.visibility as Visibility) || "members");
      setMode(((tapData as any)?.mode as TapMode) || "archive");

      const isOwner = user && projRes.data?.created_by === user.id;
      const isMember = !!memberRes?.data;
      setCanEdit(!!(isOwner || isMember));
      setLoading(false);
    })();
  }, [projectId]);

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      title: title.trim() || `${project?.title} — Tap`,
      content_md: content,
      visibility,
      last_edited_by: user?.id,
      last_edited_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    payload.mode = mode;
    let { error } = await supabase.from("bolt_taps").update(payload).eq("project_id", projectId);
    if (error && /\bmode\b/i.test(error.message)) {
      delete payload.mode;
      ({ error } = await supabase.from("bolt_taps").update(payload).eq("project_id", projectId));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("저장됐습니다");
    setTap({ ...tap, title, content_md: content, visibility, mode });
    setEditing(false);
  }

  /** Living/Dashboard 에서 호출하는 자동 저장 */
  async function autoSave(payload: { content_md?: string; widget_config?: any }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const update: any = {
      ...payload,
      last_edited_by: user?.id,
      last_edited_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("bolt_taps").update(update).eq("project_id", projectId);
    if (error) throw error;
    if (payload.content_md !== undefined) setContent(payload.content_md);
  }

  if (loading) {
    return <div className="max-w-4xl mx-auto px-6 py-12"><Loader2 className="animate-spin mx-auto text-nu-muted" size={24} /></div>;
  }
  if (!project) {
    return <div className="max-w-4xl mx-auto px-6 py-12 text-center text-nu-graphite">볼트를 찾을 수 없습니다</div>;
  }

  const isClosed = project.status === "completed";
  const retrospectiveMissing = isClosed && !project.closure_summary && !tap?.content_md?.trim();

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 pb-20">
      <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline mb-4">
        <ArrowLeft size={11} /> {project.title}
      </Link>

      {/* 마감 회고 강제 유도 */}
      {retrospectiveMissing && canEdit && (
        <div className="border-[2.5px] border-nu-amber bg-nu-amber/5 p-4 mb-6">
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-amber font-bold mb-1">🏁 회고록 필요</div>
          <p className="text-[13px] text-nu-ink leading-relaxed">
            이 볼트는 마감됐지만 아직 회고록이 없습니다. 팀의 경험이 <strong>탭 아카이브</strong>로 영구 보관되려면 회고를 작성해주세요.
          </p>
        </div>
      )}

      <header className="flex items-start justify-between gap-3 mb-6 pb-3 border-b-[2px] border-nu-ink/10">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <BookOpen size={14} className="text-nu-pink" />
            <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink font-bold">Bolt Tap</span>
            <TapModeBadge mode={mode} size="sm" />
            <VisibilityBadge visibility={tap?.visibility || "members"} />
          </div>
          {editing ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full font-head text-2xl font-extrabold text-nu-ink bg-transparent border-b border-nu-ink/20 focus:border-nu-pink outline-none"
            />
          ) : (
            <h1 className="font-head text-2xl font-extrabold text-nu-ink">{tap?.title || `${project.title} — Tap`}</h1>
          )}
          {tap?.last_edited_at && (
            <p className="font-mono-nu text-[10px] text-nu-muted mt-1">
              마지막 수정: {new Date(tap.last_edited_at).toLocaleDateString("ko")}
            </p>
          )}
        </div>
        {canEdit && !editing && activeTab === "tap" && (
          <button type="button" onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper">
            <Edit3 size={11} /> 편집
          </button>
        )}
      </header>

      {/* ── 탭 네비게이션 ─────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto mb-6 -mx-6 px-6 snap-x snap-mandatory">
          <TabsList variant="line" className="whitespace-nowrap flex-nowrap">
            <TabsTrigger value="tap" className="font-mono-nu text-[12px] uppercase tracking-widest whitespace-nowrap snap-start flex items-center gap-1">
              <Archive size={11} /> 탭 아카이브
            </TabsTrigger>
            <TabsTrigger value="recorder" className="font-mono-nu text-[12px] uppercase tracking-widest whitespace-nowrap snap-start flex items-center gap-1">
              <Mic size={11} /> 회의 녹음
            </TabsTrigger>
            <TabsTrigger value="ai-notes" className="font-mono-nu text-[12px] uppercase tracking-widest whitespace-nowrap snap-start flex items-center gap-1 text-nu-pink font-bold">
              <Sparkles size={11} /> 회의록 (AI)
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── 탭 아카이브 ─────────────────────────────── */}
        <TabsContent value="tap">
          {editing ? (
            <div className="space-y-3">
              {/* Mode 선택 */}
              <div className="flex items-center gap-2 border-b border-nu-ink/10 pb-2 flex-wrap">
                <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">모드:</span>
                {([
                  { v: "archive" as const, label: "아카이브", Icon: Archive, hint: "회고 · write-once" },
                  { v: "living" as const, label: "위키", Icon: FileEdit, hint: "실시간 협업 편집" },
                  { v: "dashboard" as const, label: "대시보드", Icon: LayoutDashboard, hint: "차트 · KPI 위젯" },
                ] as const).map(({ v, label, Icon, hint }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setMode(v)}
                    title={hint}
                    className={`inline-flex items-center gap-1 px-2 py-1 border-[2px] font-mono-nu text-[10px] uppercase transition-colors ${
                      mode === v ? "border-nu-ink bg-nu-ink text-nu-paper" : "border-nu-ink/15 text-nu-graphite hover:border-nu-ink/40"
                    }`}
                  >
                    <Icon size={10} /> {label}
                  </button>
                ))}
              </div>

              {/* AI Writer 버튼 (archive 에서만) */}
              {mode === "archive" && (
                <div className="flex items-center justify-between border-b border-nu-ink/10 pb-2">
                  <span className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-nu-muted">Editor</span>
                  <button
                    type="button"
                    onClick={() => setAiOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border-[1.5px] border-[color:var(--liquid-primary)]/40 text-[color:var(--liquid-primary)] bg-[color:var(--liquid-primary)]/5 rounded-md text-[11px] font-medium hover:bg-[color:var(--liquid-primary)]/10"
                  >
                    <Sparkles size={11} /> AI 3문 인터뷰
                  </button>
                </div>
              )}

              {/* Visibility */}
              <div className="flex items-center gap-2 border-b border-nu-ink/10 pb-2">
                <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">공개 범위:</span>
                {(["public", "members", "private"] as Visibility[]).map((v) => (
                  <button key={v} type="button" onClick={() => setVisibility(v)}
                    className={`inline-flex items-center gap-1 px-2 py-1 border-[2px] font-mono-nu text-[10px] uppercase transition-colors ${
                      visibility === v ? "border-nu-ink bg-nu-ink text-nu-paper" : "border-nu-ink/15 text-nu-graphite hover:border-nu-ink/40"
                    }`}>
                    <VisibilityIcon v={v} /> {v === "public" ? "공개" : v === "members" ? "팀원" : "비공개"}
                  </button>
                ))}
              </div>

              {/* 모드별 에디터 */}
              {mode === "archive" && (
                <>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={24}
                    placeholder={`# ${project.title} 회고\n\n## 1. 배경\n어떤 문제를 왜 풀었나요?\n\n## 2. 과정\n마일스톤별 의사결정과 배운 것\n\n## 3. 산출물\n공개 가능한 결과물·링크\n\n## 4. 다음 볼트를 위한 한 줄\n이어받을 팀이 알았으면 하는 것`}
                    className="w-full px-3 py-2 border-[2px] border-nu-ink/20 text-sm font-mono leading-relaxed focus:border-nu-pink outline-none resize-y min-h-[400px]"
                  />
                  <div className="flex items-center justify-between text-[11px] text-nu-muted">
                    <span>{content.length}자 · Markdown 지원</span>
                    <div className="flex gap-2">
                      <button onClick={() => setEditing(false)}
                        className="px-3 py-1.5 border border-nu-ink/20 font-mono-nu text-[11px] uppercase hover:bg-nu-ink/5">취소</button>
                      <button onClick={save} disabled={saving}
                        className="px-3 py-1.5 bg-nu-pink text-nu-paper font-mono-nu text-[11px] font-bold uppercase inline-flex items-center gap-1 disabled:opacity-50">
                        {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} 저장
                      </button>
                    </div>
                  </div>
                </>
              )}

              {mode === "living" && (
                <>
                  <LivingTapEditor
                    initialHtml={content}
                    onSave={async (html) => { await autoSave({ content_md: html }); }}
                    placeholder="위키처럼 자유롭게 쓰세요. 자동 저장됩니다."
                    roomId={`tap-${projectId}`}
                    user={{ name: tap?.last_edited_by || "익명 편집자" }}
                  />
                  <div className="flex items-center justify-end text-[11px] text-nu-muted">
                    <button onClick={save} disabled={saving}
                      className="px-3 py-1.5 bg-nu-pink text-nu-paper font-mono-nu text-[11px] font-bold uppercase inline-flex items-center gap-1 disabled:opacity-50">
                      {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} 완료
                    </button>
                  </div>
                </>
              )}

              {mode === "dashboard" && (
                <>
                  <DashboardTapEditor
                    projectId={projectId}
                    initialConfig={(tap?.widget_config as any) || null}
                    onSave={async (cfg) => { await autoSave({ widget_config: cfg }); }}
                  />
                  <div className="flex items-center justify-end text-[11px] text-nu-muted">
                    <button onClick={save} disabled={saving}
                      className="px-3 py-1.5 bg-nu-pink text-nu-paper font-mono-nu text-[11px] font-bold uppercase inline-flex items-center gap-1 disabled:opacity-50">
                      {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} 완료
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : mode === "dashboard" ? (
            <DashboardTapEditor
              projectId={projectId}
              initialConfig={(tap?.widget_config as any) || null}
              readOnly
            />
          ) : mode === "living" && tap?.content_md ? (
            <article
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: tap.content_md }}
            />
          ) : tap?.content_md?.trim() ? (
            <article className="prose prose-sm max-w-none whitespace-pre-wrap font-mono text-[13px] text-nu-ink leading-relaxed">
              {tap.content_md}
            </article>
          ) : (
            <div className="border-[3px] border-nu-ink bg-nu-cream/50 p-6">
              <div className="flex items-start gap-3 mb-4">
                <BookOpen size={22} className="text-nu-pink mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-head text-xl font-extrabold text-nu-ink mb-1">탭이란?</h3>
                  <p className="text-[13px] text-nu-graphite leading-relaxed">
                    볼트의 <strong>지식 베이스</strong>입니다. 회의록·자료·아이디어를 한 곳에 모아
                    AI 가 통합 정리하는 위키 시스템.
                  </p>
                </div>
              </div>

              <div className="border-l-[3px] border-nu-pink pl-4 mb-5 space-y-1.5">
                <p className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-nu-pink font-bold mb-1">시작하는 방법</p>
                <p className="text-[13px] text-nu-graphite"><span className="font-mono-nu font-bold text-nu-ink mr-1.5">1.</span>오른쪽 상단 <b>편집</b> 버튼 → 모드 선택 (아카이브/위키/대시보드)</p>
                <p className="text-[13px] text-nu-graphite"><span className="font-mono-nu font-bold text-nu-ink mr-1.5">2.</span><b>회의 녹음</b> 탭에서 녹음 → AI 회의록 초안 자동 생성</p>
                <p className="text-[13px] text-nu-graphite"><span className="font-mono-nu font-bold text-nu-ink mr-1.5">3.</span>볼트 마감 시 → <b>영구 아카이브</b>로 굳어집니다</p>
              </div>

              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setEditing(true)}
                    className="h-10 px-5 border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper font-mono-nu text-[11px] font-black uppercase tracking-widest hover:bg-nu-ink inline-flex items-center gap-2"
                  >
                    <Edit3 size={14} /> 새 탭 만들기
                  </button>
                  <button
                    onClick={() => setAiOpen(true)}
                    className="h-10 px-5 border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink hover:text-nu-paper inline-flex items-center gap-2"
                  >
                    <Sparkles size={14} /> AI 3문 인터뷰
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 마감 시 회고 제출 완료 마크 */}
          {canEdit && isClosed && tap?.content_md?.trim() && !tap?.is_retrospective_submitted && (
            <div className="mt-6 border-[2px] border-green-600 bg-green-50 p-3 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-700" />
              <span className="text-[12px] text-green-700 flex-1">회고록 작성 완료 — 탭 아카이브에 영구 보관됐습니다</span>
            </div>
          )}
        </TabsContent>

        {/* ── 회의 녹음 탭 ─────────────────────────────── */}
        <TabsContent value="recorder">
          <div className="space-y-4">
            {/* 안내 배너 */}
            <div className="flex items-center gap-2 px-3 py-2 bg-nu-pink/5 border border-nu-pink/20 text-[12px] text-nu-ink">
              <Sparkles size={12} className="text-nu-pink shrink-0" />
              <span>🎙️ 녹음 후 <b>AI 회의록 변환</b>을 누르면 자동으로 회의록 초안이 생성됩니다. 이후 <b>회의록(AI) 탭</b>에서 확인하세요.</span>
            </div>

            {/* MeetingRecorder — meetingStatus="in_progress"로 고정하여 녹음 항상 활성화 */}
            <MeetingRecorder
              ref={recorderRef}
              meetingId={boltMeetingId}
              meetingTitle={project?.title || "볼트 회의"}
              meetingStatus="in_progress"
              canEdit={canEdit}
              projectId={projectId}
              onAudioReady={() => {}}
              onTranscriptionComplete={() => {
                toast.success("AI 분석 완료! 회의록(AI) 탭을 확인하세요.");
                setActiveTab("ai-notes");
              }}
            />

            {/* 녹음 후 탭 이동 안내 */}
            <div className="flex items-center justify-between p-3 bg-nu-white border border-nu-ink/[0.08]">
              <span className="text-[12px] text-nu-muted">녹음 변환 후 AI 회의록 탭에서 내용을 확인하고 저장할 수 있습니다.</span>
              <button
                onClick={() => setActiveTab("ai-notes")}
                className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 border border-nu-ink/15 text-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-colors flex items-center gap-1"
              >
                <FileText size={11} /> 회의록 탭으로 →
              </button>
            </div>
          </div>
        </TabsContent>

        {/* ── AI 회의록 탭 ─────────────────────────────── */}
        <TabsContent value="ai-notes">
          <AiErrorBoundary fallbackTitle="AI 회의록 분석 오류">
            <AiMeetingAssistant
              meetingId={boltMeetingId}
              meetingTitle={project?.title || "볼트 회의"}
              existingNotes={meetingNotes}
              existingSummary={tap?.content_md || ""}
              agendas={[]}
              canEdit={canEdit}
              projectId={projectId}
              onSaveSummary={async (summary) => {
                // 요약을 탭 아카이브 본문에 저장
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                const update: any = {
                  content_md: summary,
                  last_edited_by: user?.id,
                  last_edited_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                await supabase.from("bolt_taps").update(update).eq("project_id", projectId);
                setContent(summary);
                setTap((prev: any) => ({ ...prev, content_md: summary }));
                toast.success("회의록이 탭 아카이브에 저장되었습니다");
              }}
              onSaveNextTopic={async (topic) => {
                // 볼트에는 next_topic 개념이 없어 탭 컨텐츠 하단에 append
                const appended = (content || tap?.content_md || "").trim()
                  ? `${(content || tap?.content_md || "").trim()}\n\n---\n## 다음 회의 주제\n${topic}`
                  : `## 다음 회의 주제\n${topic}`;
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                await supabase.from("bolt_taps").update({
                  content_md: appended,
                  last_edited_by: user?.id,
                  last_edited_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }).eq("project_id", projectId);
                setContent(appended);
                setTap((prev: any) => ({ ...prev, content_md: appended }));
              }}
              onAddNote={async () => {
                // 볼트 탭은 meeting_notes 테이블 대신 자체 content 에 추가
              }}
              onNavigateTab={(tab) => {
                if (tab === "agendas") setActiveTab("tap");
                else setActiveTab(tab);
              }}
            />
          </AiErrorBoundary>
        </TabsContent>
      </Tabs>

      {/* AI Writer Modal */}
      <TapWriterModal
        projectTitle={project?.title || "볼트"}
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        onAccept={(draft) => {
          setContent((prev) => prev.trim() ? `${prev}\n\n---\n\n${draft}` : draft);
          if (!editing) setEditing(true);
        }}
      />
    </div>
  );
}

function VisibilityIcon({ v }: { v: Visibility }) {
  if (v === "public") return <Globe size={10} />;
  if (v === "members") return <Users size={10} />;
  return <Lock size={10} />;
}

function VisibilityBadge({ visibility }: { visibility: string }) {
  const m: Record<string, { label: string; color: string }> = {
    public: { label: "공개", color: "bg-green-100 text-green-700" },
    members: { label: "팀원만", color: "bg-nu-blue/10 text-nu-blue" },
    private: { label: "비공개", color: "bg-nu-ink/10 text-nu-graphite" },
  };
  const meta = m[visibility] || m.members;
  return <span className={`inline-flex items-center gap-1 font-mono-nu text-[9px] uppercase px-1.5 py-0.5 ${meta.color}`}>{meta.label}</span>;
}
