"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Award, Shield, Star, Users, Loader2, Send, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

const DIMENSIONS = [
  { key: "planning", label: "기획", color: "text-nu-blue" },
  { key: "sincerity", label: "성실", color: "text-green-600" },
  { key: "organization", label: "정리", color: "text-nu-amber" },
  { key: "execution", label: "실행", color: "text-nu-pink" },
  { key: "expertise", label: "전문", color: "text-purple-600" },
  { key: "collaboration", label: "협업", color: "text-cyan-600" },
];

interface Endorsement {
  id: string;
  endorser_id: string;
  dimension: string;
  rating: number;
  comment?: string;
  created_at: string;
  profiles?: {
    nickname: string;
    avatar_url?: string;
  };
}

interface DimensionStats {
  count: number;
  avgRating: number;
  endorsed: boolean;
  endorsers: Array<{ id: string; nickname: string; avatar_url?: string }>;
}

export function EndorsementPanel({
  targetUserId,
  projectId,
  milestoneId,
  compact,
}: {
  targetUserId: string;
  projectId?: string;
  milestoneId?: string;
  compact?: boolean;
}) {
  const [stats, setStats] = useState<Record<string, DimensionStats>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formState, setFormState] = useState({
    selectedDimension: "planning",
    rating: 0,
    comment: "",
  });
  const [showForm, setShowForm] = useState(false);

  const loadEndorsements = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);

    try {
      let query = supabase
        .from("endorsements")
        .select(
          `
          id,
          endorser_id,
          dimension,
          rating,
          comment,
          created_at,
          profiles!endorser_id(nickname, avatar_url)
        `
        )
        .eq("endorsed_id", targetUserId);

      if (projectId) query = query.eq("project_id", projectId);
      if (milestoneId) query = query.eq("milestone_id", milestoneId);

      const { data: endorsements, error } = await query;

      if (error) {
        console.error("Failed to load endorsements:", error);
        return;
      }

      // Initialize stats for all dimensions
      const newStats: Record<string, DimensionStats> = {};
      DIMENSIONS.forEach((dim) => {
        newStats[dim.key] = {
          count: 0,
          avgRating: 0,
          endorsed: false,
          endorsers: [],
        };
      });

      // Aggregate endorsements by dimension
      if (endorsements && endorsements.length > 0) {
        endorsements.forEach((e: any) => {
          const profile = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
          if (newStats[e.dimension]) {
            newStats[e.dimension].count += 1;
            newStats[e.dimension].avgRating += e.rating;
            if (profile) {
              newStats[e.dimension].endorsers.push({
                id: e.endorser_id,
                nickname: profile.nickname,
                avatar_url: profile.avatar_url,
              });
            }
            if (e.endorser_id === currentUserId) {
              newStats[e.dimension].endorsed = true;
            }
          }
        });

        // Calculate average ratings
        Object.keys(newStats).forEach((dim) => {
          if (newStats[dim].count > 0) {
            newStats[dim].avgRating =
              Math.round((newStats[dim].avgRating / newStats[dim].count) * 10) /
              10;
          }
        });
      }

      setStats(newStats);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, projectId, milestoneId, currentUserId]);

  useEffect(() => {
    async function initUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    }
    initUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadEndorsements();
    }
  }, [currentUserId, loadEndorsements]);

  const handleSubmitEndorsement = async () => {
    if (!currentUserId || currentUserId === targetUserId) {
      toast.error("자기 자신에게는 보증할 수 없습니다");
      return;
    }

    if (stats[formState.selectedDimension]?.endorsed) {
      toast.error("이미 이 역량을 보증했습니다");
      return;
    }

    if (formState.rating === 0) {
      toast.error("평점을 선택해주세요");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("endorsements").insert({
        endorser_id: currentUserId,
        endorsed_id: targetUserId,
        dimension: formState.selectedDimension,
        rating: formState.rating,
        comment: formState.comment || null,
        project_id: projectId || null,
        milestone_id: milestoneId || null,
      });

      if (error) throw error;

      const dim = DIMENSIONS.find((d) => d.key === formState.selectedDimension);
      toast.success(`"${dim?.label}" 역량을 보증했습니다!`);

      setFormState({ selectedDimension: "planning", rating: 0, comment: "" });
      setShowForm(false);

      // Reload endorsements
      await loadEndorsements();
    } catch (err: unknown) {
    const __err = err as { message?: string; code?: number; name?: string };
      toast.error(__err.message || "보증 등록 실패");
    } finally {
      setSubmitting(false);
    }
  };

  const totalEndorsements = Object.values(stats).reduce(
    (sum, stat) => sum + stat.count,
    0
  );

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-[13px]">
        <Shield size={14} className="text-nu-blue" />
        <span className="font-mono-nu font-bold text-nu-ink">
          {totalEndorsements} 보증
        </span>
      </div>
    );
  }

  return (
    <div className="bg-nu-white border-2 border-nu-ink/[0.08] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-nu-cream/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-nu-blue" />
          <span className="font-head text-sm font-bold text-nu-ink">
            동료 검증
          </span>
          <span className="font-mono-nu text-[11px] bg-nu-blue/10 text-nu-blue px-2 py-0.5 font-bold uppercase tracking-widest">
            {totalEndorsements} verified
          </span>
        </div>
        {expanded ? (
          <ChevronUp size={16} className="text-nu-muted" />
        ) : (
          <ChevronDown size={16} className="text-nu-muted" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-nu-ink/5 pt-4 animate-in slide-in-from-top-2 duration-300">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={16} className="animate-spin text-nu-muted" />
            </div>
          ) : (
            <>
              {/* Dimensions Grid */}
              <div className="space-y-2">
                {DIMENSIONS.map((dim) => {
                  const stat = stats[dim.key];
                  const barWidth =
                    stat && stat.count > 0
                      ? `${Math.min((stat.avgRating / 5) * 100, 100)}%`
                      : "0%";

                  return (
                    <div key={dim.key} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono-nu text-[12px] font-bold text-nu-ink uppercase">
                          {dim.label}
                        </span>
                        {stat && stat.count > 0 && (
                          <span className={`font-head text-xs font-bold ${dim.color}`}>
                            {stat.avgRating.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-nu-ink/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${dim.color.replace("text-", "bg-")} transition-all duration-300`}
                            style={{ width: barWidth }}
                          />
                        </div>
                        {stat && stat.count > 0 && (
                          <span className="font-mono-nu text-[11px] text-nu-muted min-w-[30px]">
                            {stat.count}명
                          </span>
                        )}
                      </div>
                      {/* Endorser Avatars */}
                      {stat && stat.endorsers.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <div className="flex -space-x-1">
                            {stat.endorsers.slice(0, 4).map((endorser) => (
                              <div
                                key={endorser.id}
                                className="w-5 h-5 rounded-full bg-nu-blue/20 border-2 border-white flex items-center justify-center text-[9px] font-bold text-nu-blue shrink-0"
                                title={endorser.nickname}
                              >
                                {endorser.avatar_url ? (
                                  <img
                                    src={endorser.avatar_url}
                                    alt={endorser.nickname}
                                    className="w-full h-full rounded-full object-cover"
                                  />
                                ) : (
                                  endorser.nickname.charAt(0).toUpperCase()
                                )}
                              </div>
                            ))}
                          </div>
                          {stat.endorsers.length > 4 && (
                            <span className="text-[10px] text-nu-muted ml-1">
                              +{stat.endorsers.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action Button */}
              {currentUserId && currentUserId !== targetUserId && (
                <div className="pt-2 border-t border-nu-ink/5">
                  {!showForm ? (
                    <button
                      onClick={() => setShowForm(true)}
                      className="w-full px-3 py-2 bg-nu-pink text-white font-mono-nu text-[12px] font-bold uppercase tracking-widest hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
                    >
                      <Award size={12} /> 보증하기
                    </button>
                  ) : (
                    <div className="space-y-3 p-3 bg-nu-cream/20 border border-nu-ink/5">
                      {/* Dimension Dropdown */}
                      <div>
                        <label className="block font-mono-nu text-[11px] font-bold text-nu-ink mb-1 uppercase">
                          역량 선택
                        </label>
                        <select
                          value={formState.selectedDimension}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              selectedDimension: e.target.value,
                            })
                          }
                          className="w-full px-2 py-1.5 bg-white border border-nu-ink/10 text-[12px] focus:outline-none focus:border-nu-pink"
                        >
                          {DIMENSIONS.map((dim) => (
                            <option key={dim.key} value={dim.key}>
                              {dim.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Rating Stars */}
                      <div>
                        <label className="block font-mono-nu text-[11px] font-bold text-nu-ink mb-1 uppercase">
                          평점 (1-5)
                        </label>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((num) => (
                            <button
                              key={num}
                              onClick={() =>
                                setFormState({
                                  ...formState,
                                  rating: num,
                                })
                              }
                              className={`p-1 transition-all ${
                                formState.rating >= num
                                  ? "text-nu-pink scale-110"
                                  : "text-nu-ink/20"
                              }`}
                            >
                              <Star size={14} fill="currentColor" />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Comment */}
                      <div>
                        <label className="block font-mono-nu text-[11px] font-bold text-nu-ink mb-1 uppercase">
                          의견 (선택사항)
                        </label>
                        <textarea
                          value={formState.comment}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              comment: e.target.value,
                            })
                          }
                          placeholder="짧은 의견을 남겨보세요..."
                          className="w-full px-2 py-1.5 bg-white border border-nu-ink/10 text-[12px] focus:outline-none focus:border-nu-pink resize-none"
                          rows={2}
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setShowForm(false);
                            setFormState({
                              selectedDimension: "planning",
                              rating: 0,
                              comment: "",
                            });
                          }}
                          className="flex-1 px-2 py-1.5 bg-nu-ink/5 border border-nu-ink/10 font-mono-nu text-[11px] font-bold text-nu-ink hover:opacity-70 transition-opacity"
                        >
                          취소
                        </button>
                        <button
                          onClick={handleSubmitEndorsement}
                          disabled={submitting || formState.rating === 0}
                          className="flex-1 px-2 py-1.5 bg-nu-pink text-white font-mono-nu text-[11px] font-bold uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-1"
                        >
                          {submitting ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : (
                            <Send size={10} />
                          )}
                          제출
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentUserId === targetUserId && (
                <p className="text-[11px] text-nu-muted text-center py-2">
                  자신에게는 보증할 수 없습니다
                </p>
              )}

              {!currentUserId && (
                <p className="text-[11px] text-nu-muted text-center py-2">
                  로그인하면 보증할 수 있습니다
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
