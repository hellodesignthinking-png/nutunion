"use client";

/**
 * RequestQueueThread — request-queue Thread UI.
 *
 * 팀과 컨설턴트 사이의 모든 요청을 구조화된 큐로 관리.
 * 역할에 따라 RequesterView / AssigneeView로 분기.
 */

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Plus, Send, Clock, CheckCircle2, XCircle, AlertTriangle,
  Loader2, MessageSquare, ChevronDown, MoreHorizontal, Timer,
} from "lucide-react";

// ── 타입 ──
type RequestType = "advice" | "analysis" | "deliverable" | "introduction" | "review" | "other";
type Priority = "low" | "normal" | "high" | "urgent";
type RequestStatus =
  | "draft" | "submitted" | "accepted" | "in_progress"
  | "delivered" | "accepted_by_requester" | "cancelled";

interface ConsultingRequest {
  id: string;
  project_id: string;
  title: string;
  body?: string;
  requester_id?: string;
  assignee_id?: string;
  request_type: RequestType;
  priority: Priority;
  status: RequestStatus;
  estimated_hours?: number;
  actual_hours: number;
  due_date?: string;
  delivered_at?: string;
  closed_at?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

// ── 우선순위/상태 설정 ──
const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; dot: string }> = {
  urgent: { label: "긴급", color: "text-red-700 bg-red-50 border-red-200",   dot: "bg-red-500" },
  high:   { label: "높음", color: "text-orange-700 bg-orange-50 border-orange-200", dot: "bg-orange-500" },
  normal: { label: "보통", color: "text-nu-graphite bg-nu-cream/50 border-nu-ink/10", dot: "bg-nu-graphite" },
  low:    { label: "낮음", color: "text-nu-muted bg-nu-cream/30 border-nu-ink/5",    dot: "bg-nu-muted" },
};

const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string }> = {
  draft:                { label: "초안",    color: "text-nu-muted bg-nu-cream/30" },
  submitted:            { label: "제출됨",  color: "text-blue-700 bg-blue-50" },
  accepted:             { label: "수락됨",  color: "text-teal-700 bg-teal-50" },
  in_progress:          { label: "진행중",  color: "text-nu-amber bg-nu-amber/10" },
  delivered:            { label: "전달됨",  color: "text-purple-700 bg-purple-50" },
  accepted_by_requester:{ label: "완료",    color: "text-green-700 bg-green-50" },
  cancelled:            { label: "취소",    color: "text-nu-muted bg-nu-cream/20" },
};

const TYPE_LABELS: Record<RequestType, string> = {
  advice: "조언", analysis: "분석", deliverable: "산출물",
  introduction: "소개", review: "리뷰", other: "기타",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

// ── 리테이너 소진 미터 ──
function RetainerMeter({ monthlyHours, usedHours }: { monthlyHours: number; usedHours: number }) {
  const pct = Math.min(100, Math.round((usedHours / monthlyHours) * 100));
  const isWarning = pct >= 80;
  return (
    <div className="p-4 border-[2px] border-teal-200 bg-teal-50">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono-nu text-[11px] uppercase tracking-widest text-teal-700 font-bold">
          이번 달 리테이너 소진
        </span>
        <span className={`font-head text-sm font-extrabold ${isWarning ? "text-red-600" : "text-teal-700"}`}>
          {usedHours}h / {monthlyHours}h
        </span>
      </div>
      <div className="h-3 bg-teal-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isWarning ? "bg-red-500" : "bg-teal-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="font-mono-nu text-[10px] text-teal-600">{pct}% 소진</span>
        {isWarning && (
          <span className="flex items-center gap-1 font-mono-nu text-[10px] text-red-600">
            <AlertTriangle size={10} /> 80% 초과 — 잔여 {monthlyHours - usedHours}h
          </span>
        )}
      </div>
    </div>
  );
}

// ── 요청 카드 ──
function RequestCard({
  req, isAssignee, onStatusChange, expanded, onExpand,
}: {
  req: ConsultingRequest;
  isAssignee: boolean;
  onStatusChange: (id: string, status: RequestStatus) => void;
  expanded: boolean;
  onExpand: (id: string) => void;
}) {
  const statusCfg   = STATUS_CONFIG[req.status];
  const priorityCfg = PRIORITY_CONFIG[req.priority];

  const daysLeft = req.due_date
    ? Math.ceil((new Date(req.due_date).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className={`border-[2px] transition-all ${
      req.priority === "urgent" ? "border-red-200" :
      req.status === "accepted" || req.status === "in_progress" ? "border-teal-200 bg-teal-50/20" :
      req.status === "accepted_by_requester" ? "border-green-200 bg-green-50/10 opacity-80" :
      "border-nu-ink/[0.08] bg-nu-white"
    }`}>
      <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => onExpand(req.id)}>
        {/* 우선순위 점 */}
        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${priorityCfg.dot}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`font-mono-nu text-[10px] uppercase px-1.5 py-0.5 border ${priorityCfg.color}`}>
              {priorityCfg.label}
            </span>
            <span className={`font-mono-nu text-[10px] uppercase px-1.5 py-0.5 ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
            <span className="font-mono-nu text-[10px] text-nu-muted">
              [{TYPE_LABELS[req.request_type]}]
            </span>
          </div>

          <p className="font-head text-[14px] font-bold text-nu-ink mb-1 truncate">{req.title}</p>

          <div className="flex items-center gap-3 text-[12px] text-nu-muted flex-wrap">
            {req.estimated_hours && (
              <span className="flex items-center gap-1">
                <Timer size={10} /> 예상 {req.estimated_hours}h
                {req.actual_hours > 0 && ` / 실제 ${req.actual_hours}h`}
              </span>
            )}
            {daysLeft !== null && req.status !== "accepted_by_requester" && (
              <span className={`flex items-center gap-1 ${daysLeft <= 3 ? "text-red-600 font-bold" : ""}`}>
                <Clock size={10} />
                {daysLeft > 0 ? `D-${daysLeft}` : daysLeft === 0 ? "오늘 마감" : `D+${Math.abs(daysLeft)} 초과`}
              </span>
            )}
            <span className="text-[11px]">{fmtDate(req.created_at)}</span>
          </div>
        </div>

        <ChevronDown size={14} className={`text-nu-muted shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </div>

      {/* 확장 상세 + 액션 버튼 */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-nu-ink/[0.05] space-y-3">
          {req.body && (
            <div className="text-[13px] text-nu-graphite leading-relaxed bg-nu-cream/30 p-3 border border-nu-ink/[0.06] whitespace-pre-wrap">
              {req.body}
            </div>
          )}

          {/* 상태 변환 버튼 */}
          <div className="flex flex-wrap gap-2 pt-1">
            {/* 요청자 액션 */}
            {!isAssignee && req.status === "delivered" && (
              <>
                <button
                  onClick={() => onStatusChange(req.id, "accepted_by_requester")}
                  className="flex items-center gap-1.5 font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 bg-green-600 text-white hover:bg-green-700 transition-colors"
                >
                  <CheckCircle2 size={11} /> 검수 완료
                </button>
                <button
                  onClick={() => onStatusChange(req.id, "submitted")}
                  className="flex items-center gap-1.5 font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 border border-nu-amber text-nu-amber hover:bg-nu-amber/10 transition-colors"
                >
                  재요청
                </button>
              </>
            )}

            {/* 담당자(컨설턴트) 액션 */}
            {isAssignee && req.status === "submitted" && (
              <>
                <button
                  onClick={() => onStatusChange(req.id, "accepted")}
                  className="flex items-center gap-1.5 font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 bg-teal-600 text-white hover:bg-teal-700 transition-colors"
                >
                  <CheckCircle2 size={11} /> 수락
                </button>
                <button
                  onClick={() => onStatusChange(req.id, "cancelled")}
                  className="flex items-center gap-1.5 font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 border border-nu-ink/15 text-nu-muted hover:text-nu-ink transition-colors"
                >
                  <XCircle size={11} /> 거절
                </button>
              </>
            )}
            {isAssignee && req.status === "accepted" && (
              <button
                onClick={() => onStatusChange(req.id, "in_progress")}
                className="flex items-center gap-1.5 font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 bg-nu-amber text-white hover:bg-nu-amber/80 transition-colors"
              >
                <Timer size={11} /> 진행 시작
              </button>
            )}
            {isAssignee && req.status === "in_progress" && (
              <button
                onClick={() => onStatusChange(req.id, "delivered")}
                className="flex items-center gap-1.5 font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 bg-purple-600 text-white hover:bg-purple-700 transition-colors"
              >
                <Send size={11} /> 전달 완료
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 새 요청 폼 ──
function NewRequestForm({
  projectId, userId, onCreated, onCancel,
}: {
  projectId: string; userId: string; onCreated: () => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: "", body: "", request_type: "advice" as RequestType,
    priority: "normal" as Priority, due_date: "", estimated_hours: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { toast.error("요청 제목을 입력해주세요"); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("consulting_requests").insert({
        project_id: projectId,
        title: form.title.trim(),
        body: form.body || null,
        requester_id: userId,
        request_type: form.request_type,
        priority: form.priority,
        due_date: form.due_date || null,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
        status: "submitted",
        actual_hours: 0,
        tags: [],
      });
      if (error) throw error;
      toast.success("요청이 제출되었습니다");
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "요청 생성 실패");
    } finally { setSaving(false); }
  }

  const labelCls = "block font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite mb-1";
  const inputCls = "w-full px-3 py-2 border-[1.5px] border-nu-ink/15 bg-white focus:border-teal-400 outline-none text-[13px] rounded-sm";

  return (
    <form onSubmit={handleSubmit} className="border-[2px] border-teal-300 bg-teal-50/20 p-5 space-y-4">
      <div className="font-mono-nu text-[11px] uppercase tracking-widest text-teal-700 font-bold">
        📮 새 요청 작성
      </div>
      <div>
        <label className={labelCls}>요청 제목 *</label>
        <input className={inputCls} value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="예: 경쟁사 분석 요약본 요청" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>요청 유형</label>
          <select className={inputCls} value={form.request_type}
            onChange={e => setForm(f => ({ ...f, request_type: e.target.value as RequestType }))}>
            <option value="advice">조언</option>
            <option value="analysis">분석</option>
            <option value="deliverable">산출물</option>
            <option value="introduction">소개</option>
            <option value="review">리뷰</option>
            <option value="other">기타</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>우선순위</label>
          <select className={inputCls} value={form.priority}
            onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}>
            <option value="low">낮음</option>
            <option value="normal">보통</option>
            <option value="high">높음</option>
            <option value="urgent">긴급</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>상세 내용</label>
        <textarea className={inputCls + " resize-none"} rows={4} value={form.body}
          onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
          placeholder="요청 배경, 필요한 정보, 참고 자료 등..." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>납기 희망일</label>
          <input type="date" className={inputCls} value={form.due_date}
            onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
        </div>
        <div>
          <label className={labelCls}>예상 공수 (h)</label>
          <input type="number" className={inputCls} value={form.estimated_hours}
            onChange={e => setForm(f => ({ ...f, estimated_hours: e.target.value }))}
            min={0.5} step={0.5} placeholder="4" />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 font-mono-nu text-[12px] uppercase tracking-widest px-5 py-2.5 bg-teal-700 text-white hover:bg-teal-800 transition-colors disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          {saving ? "제출 중..." : "제출"}
        </button>
        <button type="button" onClick={onCancel}
          className="font-mono-nu text-[12px] uppercase tracking-widest px-5 py-2.5 border border-nu-ink/15 text-nu-muted hover:text-nu-ink transition-colors">
          취소
        </button>
      </div>
    </form>
  );
}

// ── 메인 RequestQueueThread ──
interface RequestQueueProps {
  projectId: string;
  userId: string;
  userRole?: "owner" | "team" | "consultant" | "observer";
  retainerMonthlyHours?: number | null;
}

export function RequestQueueThread({ projectId, userId, userRole, retainerMonthlyHours }: RequestQueueProps) {
  const [requests, setRequests]     = useState<ConsultingRequest[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<RequestStatus | "active" | "all">("active");

  const isAssignee = userRole === "consultant";
  const isRequester = userRole === "owner" || userRole === "team";

  const loadRequests = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("consulting_requests")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) console.warn("[request-queue]:", error.message);
    setRequests((data as ConsultingRequest[]) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  async function handleStatusChange(id: string, newStatus: RequestStatus) {
    const supabase = createClient();
    const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === "delivered") updates.delivered_at = new Date().toISOString();
    if (newStatus === "accepted_by_requester" || newStatus === "cancelled") {
      updates.closed_at = new Date().toISOString();
    }
    const { error } = await supabase.from("consulting_requests").update(updates).eq("id", id);
    if (error) { toast.error("상태 변경 실패"); return; }
    setRequests(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    toast.success(`상태가 "${STATUS_CONFIG[newStatus].label}"로 변경되었습니다`);
  }

  // 필터링
  const ACTIVE_STATUSES: RequestStatus[] = ["submitted", "accepted", "in_progress", "delivered"];
  const displayed =
    filterStatus === "active" ? requests.filter(r => ACTIVE_STATUSES.includes(r.status)) :
    filterStatus === "all"    ? requests :
    requests.filter(r => r.status === filterStatus);

  // 리테이너 소진 계산
  const thisMonth = new Date().toISOString().slice(0, 7);
  const usedHours = requests
    .filter(r => r.created_at.startsWith(thisMonth) && r.status === "accepted_by_requester")
    .reduce((sum, r) => sum + (r.actual_hours || 0), 0);

  if (loading) return (
    <div className="animate-pulse space-y-3 p-6">
      {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-nu-cream/30 rounded" />)}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-head text-lg font-extrabold text-nu-ink flex items-center gap-2">
            📮 요청 큐
          </h2>
          <p className="text-[12px] text-nu-muted mt-0.5">
            {isAssignee ? "받은 요청" : "보낸 요청"} · 비동기 구조화 협업
          </p>
        </div>
        {isRequester && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2 bg-teal-700 text-white hover:bg-teal-800 transition-colors"
          >
            <Plus size={12} /> 새 요청
          </button>
        )}
      </div>

      {/* 리테이너 소진 미터 (컨설턴트에게만) */}
      {isAssignee && retainerMonthlyHours && (
        <RetainerMeter monthlyHours={retainerMonthlyHours} usedHours={usedHours} />
      )}

      {/* 새 요청 폼 */}
      {showForm && (
        <NewRequestForm
          projectId={projectId} userId={userId}
          onCreated={() => { setShowForm(false); loadRequests(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* 상태 필터 탭 */}
      <div className="flex gap-0 border-b-[2px] border-nu-ink/[0.06] overflow-x-auto scrollbar-hide">
        {[
          { key: "active", label: "진행 중", count: requests.filter(r => ACTIVE_STATUSES.includes(r.status)).length },
          { key: "all",    label: "전체",    count: requests.length },
          { key: "accepted_by_requester", label: "완료", count: requests.filter(r => r.status === "accepted_by_requester").length },
        ].map(tab => (
          <button key={tab.key}
            onClick={() => setFilterStatus(tab.key as any)}
            className={`font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2.5 border-b-[3px] transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              filterStatus === tab.key
                ? "border-teal-500 text-teal-700 font-bold"
                : "border-transparent text-nu-muted hover:text-nu-graphite"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 ${
                filterStatus === tab.key ? "bg-teal-100 text-teal-700" : "bg-nu-ink/5 text-nu-muted"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 요청 목록 */}
      <div className="space-y-3">
        {displayed.length === 0 ? (
          <div className="text-center py-12 border-[2px] border-dashed border-nu-ink/10">
            <MessageSquare size={28} className="text-nu-muted mx-auto mb-3 opacity-40" />
            <p className="text-nu-muted text-[13px]">
              {filterStatus === "active" ? "진행 중인 요청이 없습니다" : "요청 내역이 없습니다"}
            </p>
            {isRequester && (
              <button onClick={() => setShowForm(true)}
                className="mt-3 font-mono-nu text-[11px] uppercase tracking-widest text-teal-600 hover:underline">
                + 첫 요청 보내기
              </button>
            )}
          </div>
        ) : (
          displayed.map(req => (
            <RequestCard
              key={req.id}
              req={req}
              isAssignee={isAssignee}
              onStatusChange={handleStatusChange}
              expanded={expandedId === req.id}
              onExpand={id => setExpandedId(prev => prev === id ? null : id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
