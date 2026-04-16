"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Sparkles,
  X,
  Loader2,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface BestPracticePromoteProps {
  sourceType: "meeting" | "resource" | "session";
  sourceId: string;
  groupId?: string;
  sourceName: string;
  sourceContent?: string;
  onClose: () => void;
  onPromoted?: () => void;
}

type TargetType = "curriculum" | "guideline" | "template";

interface FormState {
  title: string;
  description: string;
  targetType: TargetType;
  tags: string;
}

const TARGET_TYPES: Array<{ key: TargetType; label: string; icon: string }> = [
  { key: "curriculum", label: "공식 커리큘럼", icon: "📚" },
  { key: "guideline", label: "프로젝트 가이드라인", icon: "📋" },
  { key: "template", label: "템플릿", icon: "📄" },
];

export function BestPracticePromote({
  sourceType,
  sourceId,
  groupId,
  sourceName,
  sourceContent = "",
  onClose,
  onPromoted,
}: BestPracticePromoteProps) {
  const [formState, setFormState] = useState<FormState>({
    title: sourceName,
    description: "",
    targetType: "guideline",
    tags: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    async function initUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    }
    initUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUserId) {
      toast.error("로그인이 필요합니다");
      return;
    }

    if (!formState.title.trim()) {
      toast.error("제목을 입력해주세요");
      return;
    }

    if (!formState.description.trim()) {
      toast.error("설명을 입력해주세요");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      // Parse tags (comma-separated into array)
      const tagsArray = formState.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      // Insert into best_practices table
      const { error } = await supabase.from("best_practices").insert({
        source_type: sourceType,
        source_id: sourceId,
        group_id: groupId || null,
        title: formState.title,
        description: formState.description,
        content: {
          sourceContent: sourceContent,
        },
        target_type: formState.targetType,
        promoted_by: currentUserId,
        tags: tagsArray,
        is_published: true,
      });

      if (error) throw error;

      // Show success state
      setShowSuccess(true);
      toast.success("베스트 프랙티스로 승격되었습니다!");

      // Call callback after delay
      setTimeout(() => {
        onPromoted?.();
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error("Error promoting best practice:", err);
      toast.error(err.message || "승격 실패");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
        <div className="bg-nu-white border-2 border-nu-ink shadow-2xl w-full max-w-md mx-4 animate-in scale-in duration-300">
          <div className="px-6 py-8 flex flex-col items-center justify-center text-center">
            <div className="mb-4 relative">
              <div className="absolute inset-0 bg-nu-pink/20 rounded-full blur-xl animate-pulse" />
              <div className="relative bg-nu-pink/10 border-2 border-nu-pink rounded-full p-4">
                <Check size={32} className="text-nu-pink animate-bounce" />
              </div>
            </div>
            <h3 className="font-head text-lg font-bold text-nu-ink mb-2">
              완료!
            </h3>
            <p className="text-nu-muted text-sm">
              베스트 프랙티스 라이브러리에 추가되었습니다
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-nu-white border-2 border-nu-ink shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-nu-ink/5 sticky top-0 bg-nu-white">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-nu-pink" />
            <h2 className="font-head text-base font-bold text-nu-ink">
              베스트 프랙티스 승격
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-nu-muted hover:text-nu-ink transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Title Input */}
          <div>
            <label className="block font-mono-nu text-[11px] font-black uppercase tracking-widest text-nu-ink mb-2">
              제목
            </label>
            <input
              type="text"
              value={formState.title}
              onChange={(e) =>
                setFormState({ ...formState, title: e.target.value })
              }
              placeholder="베스트 프랙티스 제목"
              className="w-full px-3 py-2.5 bg-nu-cream/30 border-2 border-nu-ink/10 text-sm focus:outline-none focus:border-nu-pink transition-colors"
            />
          </div>

          {/* Description Textarea */}
          <div>
            <label className="block font-mono-nu text-[11px] font-black uppercase tracking-widest text-nu-ink mb-2">
              설명
            </label>
            <textarea
              value={formState.description}
              onChange={(e) =>
                setFormState({ ...formState, description: e.target.value })
              }
              placeholder="이 베스트 프랙티스에 대한 설명을 작성해주세요..."
              className="w-full px-3 py-2.5 bg-nu-cream/30 border-2 border-nu-ink/10 text-sm focus:outline-none focus:border-nu-pink transition-colors resize-none"
              rows={4}
            />
          </div>

          {/* Target Type Selector */}
          <div>
            <label className="block font-mono-nu text-[11px] font-black uppercase tracking-widest text-nu-ink mb-2">
              분류
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TARGET_TYPES.map(({ key, label, icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setFormState({ ...formState, targetType: key })
                  }
                  className={`px-3 py-2.5 border-2 transition-all ${
                    formState.targetType === key
                      ? "bg-nu-pink/10 border-nu-pink"
                      : "bg-nu-cream/30 border-nu-ink/10 hover:border-nu-pink/50"
                  }`}
                >
                  <div className="text-lg mb-1">{icon}</div>
                  <div className="text-xs font-mono-nu font-bold text-nu-ink text-center">
                    {label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Tags Input */}
          <div>
            <label className="block font-mono-nu text-[11px] font-black uppercase tracking-widest text-nu-ink mb-2">
              태그 (쉼표로 구분)
            </label>
            <input
              type="text"
              value={formState.tags}
              onChange={(e) =>
                setFormState({ ...formState, tags: e.target.value })
              }
              placeholder="예: 마케팅, 브랜딩, 디자인"
              className="w-full px-3 py-2.5 bg-nu-cream/30 border-2 border-nu-ink/10 text-sm focus:outline-none focus:border-nu-pink transition-colors"
            />
            {formState.tags && (
              <div className="mt-2 flex flex-wrap gap-1">
                {formState.tags
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter((tag) => tag.length > 0)
                  .map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-nu-blue/10 text-nu-blue text-[12px] font-mono-nu font-bold"
                    >
                      {tag}
                    </span>
                  ))}
              </div>
            )}
          </div>

          {/* Source Preview */}
          {sourceContent && (
            <div>
              <label className="block font-mono-nu text-[11px] font-black uppercase tracking-widest text-nu-ink mb-2">
                소스 콘텐츠 미리보기
              </label>
              <div className="px-3 py-2.5 bg-nu-cream/20 border border-nu-ink/5 text-[12px] text-nu-ink max-h-24 overflow-y-auto">
                {sourceContent}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t border-nu-ink/5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-nu-ink/5 border-2 border-nu-ink/10 font-mono-nu text-[12px] font-bold text-nu-ink uppercase tracking-widest hover:opacity-70 transition-opacity"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 bg-nu-pink text-white font-mono-nu text-[12px] font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  처리 중...
                </>
              ) : (
                <>
                  <Sparkles size={12} />
                  승격하기
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
