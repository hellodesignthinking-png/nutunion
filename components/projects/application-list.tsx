"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  Users,
  Filter,
  ClipboardList,
  Check,
  X,
} from "lucide-react";
import type { ProjectApplication, ApplicationStatus } from "@/lib/types";
import { MemberActivityReport } from "@/components/community/member-activity-report";

interface ApplicationListProps {
  projectId: string;
  isLead: boolean;
  userId: string;
}

const statusFilters: { value: string; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "pending", label: "검토 대기" },
  { value: "approved", label: "승인됨" },
  { value: "rejected", label: "거절됨" },
];

const statusBadge: Record<
  string,
  { label: string; className: string; icon?: typeof Clock }
> = {
  pending: {
    label: "검토 대기",
    className: "bg-amber-50 text-amber-700 border-amber-300",
    icon: Clock,
  },
  approved: {
    label: "승인됨",
    className: "bg-green-50 text-green-700 border-green-300",
    icon: CheckCircle,
  },
  rejected: {
    label: "거절됨",
    className: "bg-red-50 text-red-700 border-red-300",
    icon: XCircle,
  },
  withdrawn: {
    label: "취소됨",
    className: "bg-nu-gray/10 text-nu-gray border-nu-gray/20",
  },
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 30) return `${diffDay}일 전`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)}개월 전`;
  return `${Math.floor(diffDay / 365)}년 전`;
}

export default function ApplicationList({
  projectId,
  isLead,
}: ApplicationListProps) {
  const [applications, setApplications] = useState<ProjectApplication[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const fetchApplications = useCallback(async () => {
    const supabase = createClient();

    let query = supabase
      .from("project_applications")
      .select(
        "*, applicant:applicant_id(id, name, nickname, avatar_url, email), crew:crew_id(id, name)"
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data, error } = await query;

    if (error) {
      toast.error("지원서 목록을 불러올 수 없습니다");
      return;
    }

    // Map the nested relations to expected shape
    const mapped = (data ?? []).map((app: any) => ({
      ...app,
      applicant: app.applicant ?? undefined,
      crew: app.crew ?? undefined,
    }));

    setApplications(mapped);
    setLoading(false);
  }, [projectId, filter]);

  useEffect(() => {
    setLoading(true);
    fetchApplications();
  }, [fetchApplications]);

  async function handleAction(
    applicationId: string,
    action: "approved" | "rejected",
    applicantId: string,
    reason?: string
  ) {
    setProcessing(applicationId);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("로그인이 필요합니다");

      // Update application status
      const updatePayload: Record<string, unknown> = {
        status: action,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      };

      if (action === "rejected" && reason) {
        updatePayload.rejection_reason = reason;
      }

      const { error: updateError } = await supabase
        .from("project_applications")
        .update(updatePayload)
        .eq("id", applicationId);

      if (updateError) throw updateError;

      // If approved, add to project_members
      if (action === "approved") {
        const { error: memberError } = await supabase
          .from("project_members")
          .insert({
            project_id: projectId,
            user_id: applicantId,
            role: "member",
          });

        if (memberError) {
          // If already a member, just ignore
          if (!memberError.message.includes("duplicate")) {
            throw memberError;
          }
        }
      }

      toast.success(
        action === "approved"
          ? "지원서가 승인되었습니다"
          : "지원서가 거절되었습니다"
      );

      setRejectingId(null);
      setRejectionReason("");
      fetchApplications();
    } catch (err: unknown) {
    const __err = err as { message?: string; code?: number; name?: string };
      toast.error(__err.message || "처리 실패");
    } finally {
      setProcessing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={24} className="animate-spin text-nu-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-nu-muted" />
        <div className="flex gap-1">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`font-mono-nu text-[12px] uppercase tracking-widest px-3 py-1.5 border transition-colors ${
                filter === f.value
                  ? "bg-nu-ink text-nu-paper border-nu-ink"
                  : "border-nu-ink/[0.12] text-nu-gray hover:border-nu-ink/30"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Application cards */}
      {applications.length === 0 ? (
        <div className="text-center py-20 border-[2px] border-dashed border-nu-ink/[0.12] bg-nu-cream/10">
          <ClipboardList
            size={40}
            className="mx-auto text-nu-muted/50 mb-4"
            strokeWidth={1.5}
          />
          <p className="font-head text-sm font-bold text-nu-ink mb-1">
            아직 지원서가 없습니다
          </p>
          <p className="text-xs text-nu-muted max-w-xs mx-auto leading-relaxed">
            프로젝트에 관심있는 멤버들의 지원서가 여기에 표시됩니다
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const badge = statusBadge[app.status] ?? statusBadge.pending;
            const BadgeIcon = badge.icon;
            const applicant = app.applicant;
            const crew = app.crew;
            const isRejecting = rejectingId === app.id;

            return (
              <div
                key={app.id}
                className="border-[2px] border-nu-ink/[0.12] bg-nu-paper p-6 space-y-4"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {applicant?.avatar_url ? (
                      <img
                        src={applicant.avatar_url}
                        alt={applicant.nickname ?? applicant.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-nu-pink/10 flex items-center justify-center text-nu-pink font-head font-bold text-sm">
                        {(applicant?.nickname ?? applicant?.name ?? "?").charAt(
                          0
                        )}
                      </div>
                    )}
                    <div>
                      <p className="font-head font-bold text-nu-ink text-sm">
                        {applicant?.nickname ?? applicant?.name ?? "알 수 없음"}
                      </p>
                      <p className="text-[13px] text-nu-muted">
                        {applicant?.email}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`font-mono-nu text-[12px] uppercase tracking-widest px-2.5 py-1 border-[2px] flex items-center gap-1 ${badge.className}`}
                  >
                    {BadgeIcon && <BadgeIcon size={10} />}
                    {badge.label}
                  </span>
                </div>

                {/* Message */}
                {app.message && (
                  <p className="text-sm text-nu-ink leading-relaxed whitespace-pre-wrap border-l-2 border-nu-pink/30 pl-4">
                    {app.message}
                  </p>
                )}

                {/* Rejection reason display */}
                {app.status === "rejected" &&
                  (app as any).rejection_reason && (
                    <div className="bg-red-50/50 border border-red-200/50 px-4 py-3">
                      <p className="font-mono-nu text-[11px] uppercase tracking-widest text-red-400 mb-1">
                        거절 사유
                      </p>
                      <p className="text-xs text-red-700 leading-relaxed">
                        {(app as any).rejection_reason}
                      </p>
                    </div>
                  )}

                {/* Meta */}
                <div className="flex flex-wrap items-center gap-4 text-[13px] text-nu-muted">
                  {app.portfolio_url && (
                    <a
                      href={app.portfolio_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-nu-blue hover:underline"
                    >
                      <ExternalLink size={12} />
                      포트폴리오
                    </a>
                  )}
                  {crew && (
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {crew.name}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {formatRelativeTime(app.created_at)}
                  </span>
                </div>

                {/* Activity report for PM */}
                {isLead && app.applicant_id && (
                  <div className="pt-2 border-t border-nu-ink/[0.06]">
                    <MemberActivityReport userId={app.applicant_id} />
                  </div>
                )}

                {/* Actions */}
                {isLead && app.status === "pending" && (
                  <div className="pt-2 border-t border-nu-ink/[0.06] space-y-3">
                    {/* Rejection reason inline form */}
                    {isRejecting && (
                      <div className="bg-red-50/30 border border-red-200/40 p-4 space-y-3">
                        <label className="font-mono-nu text-[12px] uppercase tracking-widest text-red-500 block">
                          거절 사유 입력 (선택)
                        </label>
                        <textarea
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="거절 사유를 입력해주세요. 지원자에게 전달됩니다..."
                          rows={3}
                          className="w-full border-[2px] border-red-200/50 bg-nu-paper text-sm text-nu-ink p-3 resize-none focus:outline-none focus:border-red-400 placeholder:text-nu-muted/50"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              handleAction(
                                app.id,
                                "rejected",
                                app.applicant_id,
                                rejectionReason.trim() || undefined
                              )
                            }
                            disabled={processing === app.id}
                            className="flex items-center gap-1.5 font-mono-nu text-[12px] font-bold uppercase tracking-[0.1em] px-4 py-2 bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                          >
                            {processing === app.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <XCircle size={12} />
                            )}
                            거절 확인
                          </button>
                          <button
                            onClick={() => {
                              setRejectingId(null);
                              setRejectionReason("");
                            }}
                            className="flex items-center gap-1.5 font-mono-nu text-[12px] font-bold uppercase tracking-[0.1em] px-4 py-2 border border-nu-ink/[0.12] text-nu-gray hover:bg-nu-cream/30 transition-colors"
                          >
                            <X size={12} />
                            취소
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Main action buttons */}
                    {!isRejecting && (
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            handleAction(app.id, "approved", app.applicant_id)
                          }
                          disabled={processing === app.id}
                          className="flex items-center gap-1.5 font-mono-nu text-[12px] font-bold uppercase tracking-[0.1em] px-4 py-2 bg-nu-ink text-nu-paper hover:bg-nu-ink/90 transition-colors disabled:opacity-50"
                        >
                          {processing === app.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <CheckCircle size={12} />
                          )}
                          승인
                        </button>
                        <button
                          onClick={() => setRejectingId(app.id)}
                          disabled={processing === app.id}
                          className="flex items-center gap-1.5 font-mono-nu text-[12px] font-bold uppercase tracking-[0.1em] px-4 py-2 border-[2px] border-nu-red/30 text-nu-red hover:bg-nu-red/5 transition-colors disabled:opacity-50"
                        >
                          <XCircle size={12} />
                          거절
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
