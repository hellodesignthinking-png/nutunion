"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, Search, Eye, CheckCircle2, XCircle, ArrowRight,
  Loader2, ExternalLink, Clock, User, Mail, Phone, Briefcase,
  ChevronDown, X, MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Proposal {
  id: string;
  company_name: string;
  contact_email: string;
  contact_name: string | null;
  contact_phone: string | null;
  project_title: string;
  description: string | null;
  budget: string | null;
  timeline: string | null;
  required_skills: string[];
  status: string;
  admin_notes: string | null;
  reject_reason: string | null;
  converted_project_id: string | null;
  assigned_pm_id: string | null;
  submitted_by: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  // FK joins (may be null)
  submitter?: { nickname: string; email: string; avatar_url: string | null } | null;
  pm?: { nickname: string; email: string } | null;
  project?: { id: string; title: string; status: string } | null;
}

interface PmCandidate {
  id: string;
  nickname: string;
  email: string;
  avatar_url: string | null;
  role: string;
}

interface Props {
  proposals: Proposal[];
  pmCandidates: PmCandidate[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  submitted: { label: "접수됨", color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  reviewing: { label: "검토 중", color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
  approved: { label: "승인됨", color: "text-green-600", bg: "bg-green-50 border-green-200" },
  rejected: { label: "반려됨", color: "text-red-500", bg: "bg-red-50 border-red-200" },
  converted: { label: "프로젝트 전환", color: "text-nu-pink", bg: "bg-nu-pink/10 border-nu-pink/30" },
};

const BUDGET_LABELS: Record<string, string> = {
  small: "100만원 이하",
  medium: "100~500만원",
  large: "500만원 이상",
  tbd: "협의 필요",
};

const TIMELINE_LABELS: Record<string, string> = {
  urgent: "긴급 (2주 이내)",
  normal: "일반 (1~2개월)",
  long: "장기 (3개월+)",
};

export function AdminProposalList({ proposals: initialProposals, pmCandidates }: Props) {
  const router = useRouter();
  const [proposals, setProposals] = useState(initialProposals);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [selectedPmId, setSelectedPmId] = useState("");
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const filtered = proposals.filter(p => {
    if (filter !== "all" && p.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.project_title.toLowerCase().includes(q) ||
        p.company_name.toLowerCase().includes(q) ||
        p.contact_email.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selected = proposals.find(p => p.id === selectedId);

  async function handleAction(proposalId: string, action: string, extra?: any) {
    setActionLoading(action);
    try {
      const res = await fetch("/api/challenges/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId,
          action,
          adminNotes: adminNotes || undefined,
          rejectReason: rejectReason || undefined,
          assignedPmId: selectedPmId || undefined,
          ...extra,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Update local state
      setProposals(prev =>
        prev.map(p =>
          p.id === proposalId
            ? {
                ...p,
                status: data.status,
                admin_notes: adminNotes || p.admin_notes,
                reject_reason: action === "reject" ? rejectReason : p.reject_reason,
                reviewed_at: ["reject", "approve", "convert"].includes(action) ? new Date().toISOString() : p.reviewed_at,
                converted_project_id: data.projectId || p.converted_project_id,
                assigned_pm_id: selectedPmId || p.assigned_pm_id,
              }
            : p
        )
      );

      const actionLabels: Record<string, string> = {
        review: "검토 상태로 변경됨",
        approve: "승인됨",
        reject: "반려됨",
        convert: "프로젝트로 전환됨",
      };
      toast.success(actionLabels[action] || "처리 완료");

      setShowConvertModal(false);
      setShowRejectModal(false);
      setAdminNotes("");
      setRejectReason("");
      setSelectedPmId("");

      if (action === "convert" && data.projectId) {
        // Optionally navigate to the project
      }

      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "처리에 실패했습니다");
    } finally {
      setActionLoading(null);
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("ko", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* List */}
      <div className="lg:col-span-1">
        {/* Filters */}
        <div className="mb-4 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="검색..."
              className="w-full h-9 pl-9 pr-3 border border-nu-ink/10 bg-nu-white text-sm focus:outline-none focus:border-nu-pink"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {[
              { key: "all", label: "전체" },
              { key: "submitted", label: "접수" },
              { key: "reviewing", label: "검토 중" },
              { key: "approved", label: "승인" },
              { key: "converted", label: "전환" },
              { key: "rejected", label: "반려" },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`font-mono-nu text-[9px] uppercase tracking-widest px-2.5 py-1 border cursor-pointer transition-all ${
                  filter === f.key
                    ? "bg-nu-ink text-nu-paper border-nu-ink"
                    : "bg-nu-white text-nu-muted border-nu-ink/10 hover:border-nu-ink/30"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Proposal cards */}
        <div className="space-y-2 max-h-[calc(100vh-350px)] overflow-y-auto">
          {filtered.length === 0 && (
            <div className="bg-nu-white border border-nu-ink/[0.08] p-6 text-center">
              <FileText size={24} className="mx-auto mb-2 text-nu-muted/30" />
              <p className="text-sm text-nu-muted">의뢰가 없습니다</p>
            </div>
          )}
          {filtered.map(p => {
            const st = STATUS_CONFIG[p.status] || STATUS_CONFIG.submitted;
            const isActive = selectedId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`w-full text-left bg-nu-white border-[2px] p-4 transition-all cursor-pointer ${
                  isActive ? "border-nu-pink shadow-sm" : "border-nu-ink/[0.08] hover:border-nu-ink/20"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-bold text-nu-ink truncate flex-1">{p.project_title}</p>
                  <span className={`font-mono-nu text-[8px] uppercase tracking-widest px-2 py-0.5 font-bold border shrink-0 ${st.bg} ${st.color}`}>
                    {st.label}
                  </span>
                </div>
                <p className="text-[11px] text-nu-muted truncate">{p.company_name} · {p.contact_email}</p>
                <p className="font-mono-nu text-[9px] text-nu-muted mt-1">{formatDate(p.created_at)}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail Panel */}
      <div className="lg:col-span-2">
        {!selected ? (
          <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-12 text-center">
            <Eye size={32} className="mx-auto mb-3 text-nu-muted/30" />
            <p className="font-head text-lg font-bold text-nu-ink mb-1">의뢰를 선택하세요</p>
            <p className="text-sm text-nu-muted">좌측 목록에서 의뢰를 클릭하면 상세 내용을 확인할 수 있습니다</p>
          </div>
        ) : (
          <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] overflow-hidden">
            {/* Header */}
            <div className="bg-nu-ink text-nu-paper px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono-nu text-[9px] uppercase tracking-[0.25em] text-nu-pink font-bold">
                    {STATUS_CONFIG[selected.status]?.label || selected.status}
                  </span>
                  <h2 className="font-head text-lg font-extrabold mt-1">{selected.project_title}</h2>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="text-nu-paper/50 hover:text-nu-paper transition-colors cursor-pointer bg-transparent border-none"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Briefcase size={14} className="text-nu-muted" />
                  <div>
                    <p className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted">회사/단체</p>
                    <p className="text-sm font-medium">{selected.company_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-nu-muted" />
                  <div>
                    <p className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted">이메일</p>
                    <p className="text-sm font-medium">{selected.contact_email}</p>
                  </div>
                </div>
                {selected.contact_name && (
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-nu-muted" />
                    <div>
                      <p className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted">담당자</p>
                      <p className="text-sm font-medium">{selected.contact_name}</p>
                    </div>
                  </div>
                )}
                {selected.contact_phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-nu-muted" />
                    <div>
                      <p className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted">연락처</p>
                      <p className="text-sm font-medium">{selected.contact_phone}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Project Info */}
              <div className="border-t border-nu-ink/[0.06] pt-4">
                <div className="grid grid-cols-2 gap-4 mb-3">
                  {selected.budget && (
                    <div>
                      <p className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted mb-0.5">예산</p>
                      <p className="text-sm font-medium">{BUDGET_LABELS[selected.budget] || selected.budget}</p>
                    </div>
                  )}
                  {selected.timeline && (
                    <div>
                      <p className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted mb-0.5">일정</p>
                      <p className="text-sm font-medium">{TIMELINE_LABELS[selected.timeline] || selected.timeline}</p>
                    </div>
                  )}
                </div>

                {selected.required_skills && selected.required_skills.length > 0 && (
                  <div className="mb-3">
                    <p className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted mb-1.5">필요 역량</p>
                    <div className="flex flex-wrap gap-1">
                      {selected.required_skills.map((s: string) => (
                        <span key={s} className="font-mono-nu text-[9px] bg-nu-pink/10 text-nu-pink px-2 py-0.5 font-bold">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {selected.description && (
                  <div>
                    <p className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted mb-1.5">상세 설명</p>
                    <p className="text-sm text-nu-graphite leading-relaxed whitespace-pre-wrap bg-nu-cream/20 p-3 border border-nu-ink/5">
                      {selected.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Submitter info */}
              {selected.submitter && (
                <div className="border-t border-nu-ink/[0.06] pt-4">
                  <p className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted mb-1.5">제출자 (회원)</p>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-nu-ink/5 flex items-center justify-center font-head text-[10px] text-nu-muted shrink-0">
                      {selected.submitter.avatar_url ? (
                        <img src={selected.submitter.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        (selected.submitter.nickname || "?").charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{selected.submitter.nickname}</p>
                      <p className="text-[10px] text-nu-muted">{selected.submitter.email}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Admin notes / reject reason display */}
              {selected.admin_notes && (
                <div className="bg-blue-50 border border-blue-200 p-3">
                  <p className="font-mono-nu text-[8px] uppercase tracking-widest text-blue-600 mb-1">관리자 메모</p>
                  <p className="text-sm text-blue-800">{selected.admin_notes}</p>
                </div>
              )}
              {selected.reject_reason && (
                <div className="bg-red-50 border border-red-200 p-3">
                  <p className="font-mono-nu text-[8px] uppercase tracking-widest text-red-500 mb-1">반려 사유</p>
                  <p className="text-sm text-red-700">{selected.reject_reason}</p>
                </div>
              )}

              {/* Converted project link */}
              {selected.converted_project_id && (
                <div className="bg-nu-pink/5 border border-nu-pink/20 p-3">
                  <p className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-pink mb-1">전환된 프로젝트</p>
                  <Link
                    href={`/projects/${selected.converted_project_id}`}
                    className="text-sm text-nu-pink font-bold hover:underline flex items-center gap-1 no-underline"
                  >
                    {selected.project?.title || "프로젝트 보기"} <ExternalLink size={12} />
                  </Link>
                  {selected.pm && (
                    <p className="text-[10px] text-nu-muted mt-1">PM: {selected.pm.nickname} ({selected.pm.email})</p>
                  )}
                </div>
              )}

              {/* Timestamps */}
              <div className="border-t border-nu-ink/[0.06] pt-3 flex items-center gap-4 text-[10px] text-nu-muted">
                <span>접수: {formatDate(selected.created_at)}</span>
                {selected.reviewed_at && <span>검토: {formatDate(selected.reviewed_at)}</span>}
              </div>

              {/* Action Buttons */}
              {["submitted", "reviewing", "approved"].includes(selected.status) && (
                <div className="border-t border-nu-ink/[0.06] pt-4">
                  {/* Admin notes input */}
                  <div className="mb-3">
                    <label className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted block mb-1">관리자 메모</label>
                    <textarea
                      value={adminNotes}
                      onChange={e => setAdminNotes(e.target.value)}
                      rows={2}
                      className="w-full border border-nu-ink/10 px-3 py-2 text-sm focus:outline-none focus:border-nu-pink resize-none"
                      placeholder="내부 메모..."
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selected.status === "submitted" && (
                      <button
                        onClick={() => handleAction(selected.id, "review")}
                        disabled={!!actionLoading}
                        className="font-mono-nu text-[10px] uppercase tracking-widest px-4 py-2 bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {actionLoading === "review" ? <Loader2 size={12} className="animate-spin" /> : <Clock size={12} />}
                        검토 시작
                      </button>
                    )}

                    {["submitted", "reviewing"].includes(selected.status) && (
                      <>
                        <button
                          onClick={() => handleAction(selected.id, "approve")}
                          disabled={!!actionLoading}
                          className="font-mono-nu text-[10px] uppercase tracking-widest px-4 py-2 bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {actionLoading === "approve" ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                          승인
                        </button>

                        <button
                          onClick={() => setShowRejectModal(true)}
                          disabled={!!actionLoading}
                          className="font-mono-nu text-[10px] uppercase tracking-widest px-4 py-2 bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <XCircle size={12} /> 반려
                        </button>
                      </>
                    )}

                    {["submitted", "reviewing", "approved"].includes(selected.status) && (
                      <button
                        onClick={() => setShowConvertModal(true)}
                        disabled={!!actionLoading}
                        className="font-mono-nu text-[10px] uppercase tracking-widest px-4 py-2 bg-nu-ink text-nu-paper border border-nu-ink hover:bg-nu-graphite transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <ArrowRight size={12} /> 프로젝트 전환
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Reject Modal */}
            {showRejectModal && selected && (
              <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/40 p-4">
                <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] w-full max-w-md overflow-hidden">
                  <div className="bg-red-50 px-5 py-3 border-b border-red-200">
                    <h3 className="font-head text-sm font-bold text-red-700">의뢰 반려</h3>
                  </div>
                  <div className="p-5 space-y-3">
                    <p className="text-sm text-nu-graphite">
                      <strong>{selected.project_title}</strong> 의뢰를 반려하시겠습니까?
                    </p>
                    <div>
                      <label className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted block mb-1">반려 사유</label>
                      <textarea
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        rows={3}
                        className="w-full border border-nu-ink/10 px-3 py-2 text-sm focus:outline-none focus:border-red-400 resize-none"
                        placeholder="반려 사유를 입력해주세요..."
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => { setShowRejectModal(false); setRejectReason(""); }}
                        className="font-mono-nu text-[10px] uppercase tracking-widest px-4 py-2 border border-nu-ink/10 text-nu-muted hover:bg-nu-ink/5 transition-all cursor-pointer"
                      >
                        취소
                      </button>
                      <button
                        onClick={() => handleAction(selected.id, "reject")}
                        disabled={!!actionLoading}
                        className="font-mono-nu text-[10px] uppercase tracking-widest px-4 py-2 bg-red-500 text-white border border-red-500 hover:bg-red-600 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {actionLoading === "reject" ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                        반려 확인
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Convert Modal */}
            {showConvertModal && selected && (
              <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/40 p-4">
                <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] w-full max-w-md overflow-hidden">
                  <div className="bg-nu-ink px-5 py-3">
                    <h3 className="font-head text-sm font-bold text-nu-paper">프로젝트 전환</h3>
                  </div>
                  <div className="p-5 space-y-4">
                    <p className="text-sm text-nu-graphite">
                      <strong>{selected.project_title}</strong> 의뢰를 프로젝트로 전환합니다.
                    </p>

                    <div>
                      <label className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted block mb-1.5">PM 배정 *</label>
                      <select
                        value={selectedPmId}
                        onChange={e => setSelectedPmId(e.target.value)}
                        className="w-full h-10 border border-nu-ink/10 px-3 text-sm focus:outline-none focus:border-nu-pink"
                      >
                        <option value="">PM을 선택해주세요</option>
                        {pmCandidates.map(pm => (
                          <option key={pm.id} value={pm.id}>
                            {pm.nickname} ({pm.email}){pm.role === "admin" ? " [관리자]" : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => { setShowConvertModal(false); setSelectedPmId(""); }}
                        className="font-mono-nu text-[10px] uppercase tracking-widest px-4 py-2 border border-nu-ink/10 text-nu-muted hover:bg-nu-ink/5 transition-all cursor-pointer"
                      >
                        취소
                      </button>
                      <button
                        onClick={() => {
                          if (!selectedPmId) {
                            toast.error("PM을 선택해주세요");
                            return;
                          }
                          handleAction(selected.id, "convert");
                        }}
                        disabled={!!actionLoading || !selectedPmId}
                        className="font-mono-nu text-[10px] uppercase tracking-widest px-4 py-2 bg-nu-ink text-nu-paper border border-nu-ink hover:bg-nu-graphite transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {actionLoading === "convert" ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                        프로젝트 전환
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
