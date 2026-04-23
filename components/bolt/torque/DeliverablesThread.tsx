"use client";

/**
 * DeliverablesThread — deliverables Thread UI.
 *
 * 컨설팅 전 기간의 산출물 중앙 저장소.
 * 카테고리/단계별 필터 + 검수 워크플로 + 버전 표시.
 */

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Plus, FileText, CheckCircle2, Clock, Tag,
  Loader2, ExternalLink, ChevronDown, Eye,
} from "lucide-react";

// ── 타입 ──
type DeliverableCategory =
  | "proposal" | "analysis" | "report" | "template"
  | "playbook" | "presentation" | "decision_memo" | "other";
type DeliverableStage = "draft" | "review" | "approved" | "delivered" | "archived";
type ConsultingPhase = "discovery" | "diagnosis" | "proposal" | "review" | "all";

interface Deliverable {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  category: DeliverableCategory;
  stage: DeliverableStage;
  author_id?: string;
  file_url?: string;
  content_md?: string;
  version: string;
  tags: string[];
  approved_at?: string;
  created_at: string;
}

// ── 설정 ──
const CATEGORY_LABELS: Record<DeliverableCategory, string> = {
  proposal: "제안서", analysis: "분석", report: "보고서",
  template: "템플릿", playbook: "플레이북",
  presentation: "프레젠테이션", decision_memo: "의사결정 메모", other: "기타",
};

const STAGE_CONFIG: Record<DeliverableStage, { label: string; color: string }> = {
  draft:     { label: "초안",    color: "text-nu-muted bg-nu-cream/50 border-nu-ink/10" },
  review:    { label: "검수 중", color: "text-nu-amber bg-nu-amber/10 border-nu-amber/20" },
  approved:  { label: "승인됨",  color: "text-green-700 bg-green-50 border-green-200" },
  delivered: { label: "전달됨",  color: "text-teal-700 bg-teal-50 border-teal-200" },
  archived:  { label: "보관",    color: "text-nu-muted bg-nu-cream/20 border-nu-ink/5" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

// ── 산출물 카드 ──
function DeliverableCard({
  item, canEdit, onApprove, onExpand, expanded,
}: {
  item: Deliverable;
  canEdit: boolean;
  onApprove: (id: string) => void;
  onExpand: (id: string) => void;
  expanded: boolean;
}) {
  const stageCfg = STAGE_CONFIG[item.stage];

  return (
    <div className={`border-[2px] transition-all ${
      item.stage === "review" ? "border-nu-amber/30 bg-nu-amber/5" :
      item.stage === "approved" || item.stage === "delivered" ? "border-green-200 bg-green-50/20" :
      "border-nu-ink/[0.08] bg-nu-white"
    }`}>
      <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => onExpand(item.id)}>
        <div className="text-teal-600 mt-0.5 shrink-0">
          <FileText size={16} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`font-mono-nu text-[10px] uppercase px-1.5 py-0.5 border ${stageCfg.color}`}>
              {stageCfg.label}
            </span>
            <span className="font-mono-nu text-[10px] text-nu-muted uppercase">
              {CATEGORY_LABELS[item.category]}
            </span>
            <span className="font-mono-nu text-[10px] text-nu-muted">v{item.version}</span>
          </div>

          <p className="font-head text-[14px] font-bold text-nu-ink mb-1">{item.title}</p>

          {item.description && (
            <p className="text-[12px] text-nu-muted truncate">{item.description}</p>
          )}

          {item.tags.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {item.tags.map(tag => (
                <span key={tag} className="font-mono-nu text-[10px] px-1.5 py-0.5 bg-teal-50 text-teal-600 border border-teal-100">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {item.file_url && (
            <a
              href={item.file_url}
              target="_blank"
              rel="noreferrer"
              onClick={e => e.stopPropagation()}
              className="p-1.5 border border-nu-ink/10 text-nu-muted hover:text-teal-600 hover:border-teal-300 transition-colors"
            >
              <ExternalLink size={12} />
            </a>
          )}
          <span className="font-mono-nu text-[10px] text-nu-muted">{fmtDate(item.created_at)}</span>
          <ChevronDown size={14} className={`text-nu-muted transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </div>

      {/* 확장 상세 */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-nu-ink/[0.05] space-y-3">
          {item.content_md && (
            <div>
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-2">내용 미리보기</p>
              <div className="text-[13px] text-nu-graphite leading-relaxed bg-nu-cream/30 p-3 border border-nu-ink/[0.06] whitespace-pre-wrap max-h-48 overflow-y-auto">
                {item.content_md}
              </div>
            </div>
          )}

          {/* 검수 완료 시점 */}
          {item.approved_at && (
            <p className="text-[12px] text-green-600 flex items-center gap-1.5">
              <CheckCircle2 size={12} /> {fmtDate(item.approved_at)} 승인됨
            </p>
          )}

          {/* 검수 액션 */}
          {canEdit && item.stage === "review" && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => onApprove(item.id)}
                className="flex items-center gap-1.5 font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                <CheckCircle2 size={11} /> 승인
              </button>
              <button
                className="flex items-center gap-1.5 font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 border border-nu-amber text-nu-amber hover:bg-nu-amber/10 transition-colors"
              >
                수정 요청
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 새 산출물 폼 ──
function NewDeliverableForm({
  projectId, userId, onCreated, onCancel,
}: {
  projectId: string; userId: string; onCreated: () => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: "", description: "", category: "report" as DeliverableCategory,
    file_url: "", content_md: "", tags: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { toast.error("제목을 입력해주세요"); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("consulting_deliverables").insert({
        project_id: projectId,
        title: form.title.trim(),
        description: form.description || null,
        category: form.category,
        file_url: form.file_url || null,
        content_md: form.content_md || null,
        stage: "draft",
        version: "1.0",
        author_id: userId,
        tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      });
      if (error) throw error;
      toast.success("산출물이 등록되었습니다");
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "산출물 등록 실패");
    } finally { setSaving(false); }
  }

  const labelCls = "block font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite mb-1";
  const inputCls = "w-full px-3 py-2 border-[1.5px] border-nu-ink/15 bg-white focus:border-teal-400 outline-none text-[13px] rounded-sm";

  return (
    <form onSubmit={handleSubmit} className="border-[2px] border-teal-300 bg-teal-50/20 p-5 space-y-4">
      <div className="font-mono-nu text-[11px] uppercase tracking-widest text-teal-700 font-bold">📄 새 산출물 등록</div>
      <div>
        <label className={labelCls}>제목 *</label>
        <input className={inputCls} value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="예: Q2 브랜드 포지셔닝 제안서" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>카테고리</label>
          <select className={inputCls} value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value as DeliverableCategory }))}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>태그 (쉼표 구분)</label>
          <input className={inputCls} value={form.tags}
            onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
            placeholder="브랜딩, Q2, 전략" />
        </div>
      </div>
      <div>
        <label className={labelCls}>파일 URL (선택)</label>
        <input className={inputCls} value={form.file_url}
          onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))}
          placeholder="https://drive.google.com/..." type="url" />
      </div>
      <div>
        <label className={labelCls}>설명</label>
        <textarea className={inputCls + " resize-none"} rows={2} value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="산출물의 목적과 핵심 내용을 간단히..." />
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 font-mono-nu text-[12px] uppercase tracking-widest px-5 py-2.5 bg-teal-700 text-white hover:bg-teal-800 transition-colors disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          {saving ? "저장 중..." : "등록"}
        </button>
        <button type="button" onClick={onCancel}
          className="font-mono-nu text-[12px] uppercase tracking-widest px-5 py-2.5 border border-nu-ink/15 text-nu-muted hover:text-nu-ink transition-colors">
          취소
        </button>
      </div>
    </form>
  );
}

// ── 메인 DeliverablesThread ──
interface Props {
  projectId: string;
  userId: string;
  canEdit?: boolean;
}

export function DeliverablesThread({ projectId, userId, canEdit = false }: Props) {
  const [items, setItems]           = useState<Deliverable[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStage, setFilterStage] = useState<DeliverableStage | "all">("all");

  const loadItems = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("consulting_deliverables")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) console.warn("[deliverables]:", error.message);
    setItems((data as Deliverable[]) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadItems(); }, [loadItems]);

  async function handleApprove(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("consulting_deliverables")
      .update({ stage: "approved", approved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error("승인 실패"); return; }
    setItems(prev => prev.map(i => i.id === id ? { ...i, stage: "approved", approved_at: new Date().toISOString() } : i));
    toast.success("산출물이 승인되었습니다");
  }

  const reviewCount  = items.filter(i => i.stage === "review").length;
  const displayed    = filterStage === "all" ? items : items.filter(i => i.stage === filterStage);

  if (loading) return (
    <div className="animate-pulse space-y-3 p-6">
      {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-nu-cream/30 rounded" />)}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-head text-lg font-extrabold text-nu-ink flex items-center gap-2">
            📄 산출물 라이브러리
          </h2>
          <p className="text-[12px] text-nu-muted mt-0.5">컨설팅 전 기간 산출물 중앙 저장소</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2 bg-teal-700 text-white hover:bg-teal-800 transition-colors"
        >
          <Plus size={12} /> 산출물 등록
        </button>
      </div>

      {/* 검수 대기 배너 */}
      {reviewCount > 0 && canEdit && (
        <div className="flex items-center gap-3 p-3 bg-nu-amber/10 border-[2px] border-nu-amber/30 text-[13px]">
          <Clock size={14} className="text-nu-amber shrink-0" />
          <span className="text-nu-amber font-bold">{reviewCount}개</span>
          <span className="text-nu-graphite">산출물이 검수를 기다리고 있습니다</span>
          <button
            onClick={() => setFilterStage("review")}
            className="ml-auto font-mono-nu text-[11px] uppercase tracking-widest text-nu-amber underline"
          >
            검수 보기
          </button>
        </div>
      )}

      {/* 새 산출물 폼 */}
      {showForm && (
        <NewDeliverableForm
          projectId={projectId} userId={userId}
          onCreated={() => { setShowForm(false); loadItems(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* 단계 필터 */}
      <div className="flex gap-0 border-b-[2px] border-nu-ink/[0.06] overflow-x-auto scrollbar-hide">
        {[
          { key: "all",       label: "전체",    count: items.length },
          { key: "review",    label: "검수 중", count: items.filter(i => i.stage === "review").length },
          { key: "approved",  label: "승인됨",  count: items.filter(i => i.stage === "approved").length },
          { key: "draft",     label: "초안",    count: items.filter(i => i.stage === "draft").length },
          { key: "archived",  label: "보관",    count: items.filter(i => i.stage === "archived").length },
        ].map(tab => (
          <button key={tab.key}
            onClick={() => setFilterStage(tab.key as any)}
            className={`font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2.5 border-b-[3px] transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              filterStage === tab.key
                ? "border-teal-500 text-teal-700 font-bold"
                : "border-transparent text-nu-muted hover:text-nu-graphite"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 ${
                filterStage === tab.key ? "bg-teal-100 text-teal-700" : "bg-nu-ink/5 text-nu-muted"
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* 산출물 목록 */}
      <div className="space-y-3">
        {displayed.length === 0 ? (
          <div className="text-center py-12 border-[2px] border-dashed border-nu-ink/10">
            <FileText size={28} className="text-nu-muted mx-auto mb-3 opacity-40" />
            <p className="text-nu-muted text-[13px]">
              {filterStage === "all" ? "등록된 산출물이 없습니다" : `${STAGE_CONFIG[filterStage as DeliverableStage]?.label || filterStage} 산출물이 없습니다`}
            </p>
            <button onClick={() => setShowForm(true)}
              className="mt-3 font-mono-nu text-[11px] uppercase tracking-widest text-teal-600 hover:underline">
              + 첫 산출물 등록하기
            </button>
          </div>
        ) : (
          displayed.map(item => (
            <DeliverableCard
              key={item.id}
              item={item}
              canEdit={canEdit}
              onApprove={handleApprove}
              onExpand={id => setExpandedId(prev => prev === id ? null : id)}
              expanded={expandedId === item.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
