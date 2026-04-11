"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Edit3, Trash2, ExternalLink, Calendar, Tag, Image,
  Award, GraduationCap, Briefcase, FileText, X, Loader2, Check,
} from "lucide-react";
import { toast } from "sonner";

interface Portfolio {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  category: "project" | "award" | "certification" | "education" | "experience" | "other";
  tags: string[];
  image_url?: string;
  external_link?: string;
  source: "self" | "nutunion";
  started_at?: string;
  ended_at?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

const CATEGORY_MAP: Record<string, { label: string; icon: any; color: string }> = {
  project: { label: "프로젝트", icon: Briefcase, color: "bg-nu-blue text-white" },
  award: { label: "수상 경력", icon: Award, color: "bg-nu-pink text-white" },
  certification: { label: "자격증", icon: FileText, color: "bg-nu-amber text-white" },
  education: { label: "학력", icon: GraduationCap, color: "bg-green-600 text-white" },
  experience: { label: "경험", icon: Briefcase, color: "bg-nu-ink text-white" },
  other: { label: "기타", icon: FileText, color: "bg-nu-gray text-white" },
};

interface FormState {
  title: string;
  category: "project" | "award" | "certification" | "education" | "experience" | "other";
  description: string;
  tagsInput: string;
  external_link: string;
  image_url: string;
  started_at: string;
  ended_at: string;
}

const INITIAL_FORM_STATE: FormState = {
  title: "",
  category: "project",
  description: "",
  tagsInput: "",
  external_link: "",
  image_url: "",
  started_at: "",
  ended_at: "",
};

export function PortfolioManager({ userId }: { userId: string }) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(INITIAL_FORM_STATE);
  const router = useRouter();
  const supabase = createClient();

  // Load portfolios
  const loadPortfolios = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("portfolios")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading portfolios:", error);
        toast.error("포트폴리오를 불러올 수 없습니다");
        return;
      }

      setPortfolios(data || []);
    } catch (err) {
      console.error("Error:", err);
      toast.error("오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortfolios();
  }, [userId]);

  // Reset form
  const resetForm = () => {
    setFormState(INITIAL_FORM_STATE);
    setEditingId(null);
  };

  // Load portfolio for editing
  const handleEdit = (portfolio: Portfolio) => {
    setFormState({
      title: portfolio.title,
      category: portfolio.category,
      description: portfolio.description || "",
      tagsInput: portfolio.tags?.join(", ") || "",
      external_link: portfolio.external_link || "",
      image_url: portfolio.image_url || "",
      started_at: portfolio.started_at || "",
      ended_at: portfolio.ended_at || "",
    });
    setEditingId(portfolio.id);
    setShowForm(true);
  };

  // Submit form (create or update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formState.title.trim()) {
      toast.error("제목을 입력해주세요");
      return;
    }

    setSubmitting(true);
    try {
      const tags = formState.tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const data = {
        title: formState.title,
        category: formState.category,
        description: formState.description,
        tags,
        external_link: formState.external_link || null,
        image_url: formState.image_url || null,
        started_at: formState.started_at || null,
        ended_at: formState.ended_at || null,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        // Update
        const { error } = await supabase
          .from("portfolios")
          .update(data)
          .eq("id", editingId);

        if (error) {
          console.error("Update error:", error);
          toast.error("포트폴리오 업데이트에 실패했습니다");
          return;
        }
        toast.success("포트폴리오가 수정되었습니다");
      } else {
        // Create
        const { error } = await supabase.from("portfolios").insert({
          user_id: userId,
          source: "self",
          ...data,
        });

        if (error) {
          console.error("Create error:", error);
          toast.error("포트폴리오 생성에 실패했습니다");
          return;
        }
        toast.success("포트폴리오가 추가되었습니다");
      }

      resetForm();
      setShowForm(false);
      await loadPortfolios();
      router.refresh();
    } catch (err) {
      console.error("Error:", err);
      toast.error("오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete portfolio
  const handleDelete = async (id: string) => {
    if (!confirm("이 포트폴리오를 삭제하시겠습니까?")) {
      return;
    }

    setDeleting(id);
    try {
      const { error } = await supabase
        .from("portfolios")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Delete error:", error);
        toast.error("포트폴리오 삭제에 실패했습니다");
        return;
      }

      toast.success("포트폴리오가 삭제되었습니다");
      await loadPortfolios();
      router.refresh();
    } catch (err) {
      console.error("Error:", err);
      toast.error("오류가 발생했습니다");
    } finally {
      setDeleting(null);
    }
  };

  const getCategoryIcon = (category: string) => {
    const config = CATEGORY_MAP[category] || CATEGORY_MAP.other;
    return <config.icon size={14} />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-nu-pink" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Form Section */}
      {showForm && (
        <div className="bg-nu-white border-2 border-nu-ink p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-head text-base font-bold uppercase tracking-tight text-nu-ink">
              {editingId ? "포트폴리오 수정" : "새 포트폴리오 추가"}
            </h3>
            <button
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              className="text-nu-muted hover:text-nu-ink transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink mb-2 font-semibold">
                제목 *
              </label>
              <Input
                value={formState.title}
                onChange={(e) =>
                  setFormState({ ...formState, title: e.target.value })
                }
                placeholder="포트폴리오 제목"
                className="border-2 border-nu-ink/20 focus:border-nu-pink"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink mb-2 font-semibold">
                카테고리
              </label>
              <Select
                value={formState.category}
                onValueChange={(value: any) =>
                  setFormState({ ...formState, category: value })
                }
              >
                <SelectTrigger className="border-2 border-nu-ink/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_MAP).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div>
              <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink mb-2 font-semibold">
                설명
              </label>
              <Textarea
                value={formState.description}
                onChange={(e) =>
                  setFormState({ ...formState, description: e.target.value })
                }
                placeholder="포트폴리오 설명을 입력해주세요"
                className="border-2 border-nu-ink/20 focus:border-nu-pink resize-none"
                rows={3}
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink mb-2 font-semibold">
                태그 (쉼표로 구분)
              </label>
              <Input
                value={formState.tagsInput}
                onChange={(e) =>
                  setFormState({ ...formState, tagsInput: e.target.value })
                }
                placeholder="예: React, 디자인, 협업"
                className="border-2 border-nu-ink/20 focus:border-nu-pink"
              />
            </div>

            {/* External Link */}
            <div>
              <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink mb-2 font-semibold">
                외부 링크
              </label>
              <Input
                value={formState.external_link}
                onChange={(e) =>
                  setFormState({ ...formState, external_link: e.target.value })
                }
                placeholder="https://example.com"
                type="url"
                className="border-2 border-nu-ink/20 focus:border-nu-pink"
              />
            </div>

            {/* Image URL */}
            <div>
              <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink mb-2 font-semibold">
                이미지 URL
              </label>
              <Input
                value={formState.image_url}
                onChange={(e) =>
                  setFormState({ ...formState, image_url: e.target.value })
                }
                placeholder="https://example.com/image.jpg"
                type="url"
                className="border-2 border-nu-ink/20 focus:border-nu-pink"
              />
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink mb-2 font-semibold">
                  시작일
                </label>
                <Input
                  value={formState.started_at}
                  onChange={(e) =>
                    setFormState({ ...formState, started_at: e.target.value })
                  }
                  type="date"
                  className="border-2 border-nu-ink/20 focus:border-nu-pink"
                />
              </div>
              <div>
                <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink mb-2 font-semibold">
                  종료일
                </label>
                <Input
                  value={formState.ended_at}
                  onChange={(e) =>
                    setFormState({ ...formState, ended_at: e.target.value })
                  }
                  type="date"
                  className="border-2 border-nu-ink/20 focus:border-nu-pink"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-4 border-t border-nu-ink/10">
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-nu-pink text-white border-2 border-nu-pink font-bold uppercase tracking-widest text-sm h-10 hover:bg-nu-pink/90"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-2" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Check size={14} className="mr-2" />
                    저장
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="flex-1 border-2 border-nu-ink bg-white text-nu-ink font-bold uppercase tracking-widest text-sm h-10 hover:bg-nu-cream"
              >
                취소
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Add Button */}
      {!showForm && (
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="w-full border-2 border-dashed border-nu-pink bg-nu-pink/5 text-nu-pink py-3 font-mono-nu text-sm font-bold uppercase tracking-widest hover:bg-nu-pink/10 transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          새 포트폴리오 추가
        </button>
      )}

      {/* Portfolio Grid */}
      {portfolios.length === 0 ? (
        <div className="bg-nu-white border border-nu-ink/[0.08] p-12 text-center">
          <FileText size={32} className="text-nu-muted/30 mx-auto mb-3" />
          <p className="text-nu-gray text-sm font-head">
            등록된 포트폴리오가 없습니다
          </p>
          <p className="text-xs text-nu-muted mt-1 font-mono-nu">
            성과와 경험을 공유해보세요
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {portfolios.map((portfolio) => {
            const catConfig = CATEGORY_MAP[portfolio.category] || CATEGORY_MAP.other;
            return (
              <div
                key={portfolio.id}
                className="bg-nu-white border-2 border-nu-ink/[0.08] overflow-hidden group hover:border-nu-pink/30 transition-colors"
              >
                {/* Thumbnail */}
                <div className="h-32 bg-nu-cream relative overflow-hidden">
                  {portfolio.image_url ? (
                    <img
                      src={portfolio.image_url}
                      alt={portfolio.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        {<catConfig.icon size={32} className="text-nu-ink/10 mx-auto" />}
                      </div>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <span
                      className={`${catConfig.color} text-[8px] px-2 py-1 font-bold uppercase tracking-widest`}
                    >
                      {catConfig.label}
                    </span>
                    <span className="bg-nu-ink/80 text-white text-[8px] px-2 py-1 font-bold uppercase tracking-widest">
                      {portfolio.source === "self" ? "Self-Registered" : "Verified"}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  {/* Title */}
                  <h4 className="font-head text-sm font-bold text-nu-ink mb-2">
                    {portfolio.title}
                  </h4>

                  {/* Description */}
                  {portfolio.description && (
                    <p className="text-[10px] text-nu-muted mb-3 line-clamp-2 font-mono-nu">
                      {portfolio.description}
                    </p>
                  )}

                  {/* Tags */}
                  {portfolio.tags && portfolio.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {portfolio.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 bg-nu-cream text-nu-ink text-[8px] px-1.5 py-0.5 font-mono-nu font-semibold uppercase border border-nu-ink/10"
                        >
                          <Tag size={8} />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Date range */}
                  <div className="flex items-center gap-1 text-[10px] text-nu-muted mb-3 font-mono-nu">
                    {portfolio.started_at && (
                      <>
                        <Calendar size={10} />
                        <span>{portfolio.started_at}</span>
                        {portfolio.ended_at && (
                          <>
                            <span className="mx-0.5">→</span>
                            <span>{portfolio.ended_at}</span>
                          </>
                        )}
                      </>
                    )}
                  </div>

                  {/* Footer: Link and Actions */}
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-nu-ink/10">
                    <div className="flex-1">
                      {portfolio.external_link && (
                        <a
                          href={portfolio.external_link}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-nu-blue text-[9px] font-mono-nu font-bold uppercase tracking-widest hover:underline"
                        >
                          VIEW <ExternalLink size={10} />
                        </a>
                      )}
                    </div>

                    {/* Edit and Delete buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(portfolio)}
                        disabled={submitting || deleting !== null}
                        className="p-1.5 text-nu-muted hover:text-nu-pink transition-colors disabled:opacity-50"
                        title="편집"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(portfolio.id)}
                        disabled={submitting || deleting === portfolio.id}
                        className="p-1.5 text-nu-muted hover:text-nu-red transition-colors disabled:opacity-50"
                        title="삭제"
                      >
                        {deleting === portfolio.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
