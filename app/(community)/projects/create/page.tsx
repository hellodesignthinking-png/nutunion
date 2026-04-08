"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import type { Specialty } from "@/lib/types";

const categories: { value: Specialty; label: string }[] = [
  { value: "space", label: "Space" },
  { value: "culture", label: "Culture" },
  { value: "platform", label: "Platform" },
  { value: "vibe", label: "Vibe" },
];

export default function ProjectCreatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Specialty>("space");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    async function checkPermission() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, can_create_crew, can_create_project, grade")
        .eq("id", user.id)
        .single();

      const canCreate =
        profile?.role === "admin" ||
        profile?.can_create_project === true ||
        profile?.can_create_crew === true ||
        profile?.grade === "gold" ||
        profile?.grade === "vip";

      if (!canCreate) {
        toast.error("프로젝트를 개설하려면 골드 등급 이상이 필요합니다");
        router.push("/projects");
        return;
      }
      setChecking(false);
    }
    checkPermission();
  }, [router]);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("프로젝트 제목을 입력해주세요");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다");

      let imageUrl: string | null = null;

      // Upload image if selected
      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `projects/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("media")
          .upload(path, imageFile, {
            contentType: imageFile.type,
            upsert: true
          });

        if (uploadError) {
          toast.error("이미지 업로드 실패: " + uploadError.message);
          setLoading(false);
          return;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("media").getPublicUrl(path);
        imageUrl = publicUrl;
      }

      // Insert project
      const { data: project, error } = await supabase
        .from("projects")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          category,
          status: "active",
          start_date: startDate || null,
          end_date: endDate || null,
          image_url: imageUrl,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Add creator as lead member
      await supabase.from("project_members").insert({
        project_id: project.id,
        user_id: user.id,
        role: "lead",
      });

      toast.success("프로젝트가 생성되었습니다!");
      router.push(`/projects/${project.id}`);
    } catch (err: any) {
      toast.error(err.message || "프로젝트 생성 실패");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="max-w-2xl mx-auto px-8 py-20 flex justify-center">
        <Loader2 size={24} className="animate-spin text-nu-muted" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-8 py-12">
      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-2">
        새 프로젝트 만들기
      </h1>
      <p className="text-nu-gray text-sm mb-8">
        크루와 멤버들이 함께할 프로젝트를 시작하세요
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">
            프로젝트 제목 *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="프로젝트 이름을 입력하세요"
            className="w-full px-4 py-3 bg-nu-white border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink transition-colors"
            required
          />
        </div>

        {/* Category */}
        <div>
          <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">
            카테고리 *
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Specialty)}
            className="w-full px-4 py-3 bg-nu-white border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink transition-colors"
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">
            설명
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="프로젝트에 대한 설명을 입력하세요"
            rows={4}
            className="w-full px-4 py-3 bg-nu-white border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink transition-colors resize-none"
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">
              시작일
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-3 bg-nu-white border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink transition-colors"
            />
          </div>
          <div>
            <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">
              종료일
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-3 bg-nu-white border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink transition-colors"
            />
          </div>
        </div>

        {/* Image upload */}
        <div>
          <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">
            커버 이미지
          </label>
          <div className="border border-dashed border-nu-ink/20 p-6 text-center">
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="미리보기"
                  className="max-h-48 mx-auto object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  className="mt-2 font-mono-nu text-[10px] text-nu-red uppercase tracking-widest"
                >
                  삭제
                </button>
              </div>
            ) : (
              <label className="cursor-pointer flex flex-col items-center gap-2">
                <Upload size={24} className="text-nu-muted" />
                <span className="text-sm text-nu-gray">
                  클릭하여 이미지 업로드
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full font-mono-nu text-[11px] font-bold uppercase tracking-[0.1em] py-4 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> 생성 중...
            </>
          ) : (
            "프로젝트 만들기"
          )}
        </button>
      </form>
    </div>
  );
}
