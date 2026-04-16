"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Save, Image as ImageIcon, Video, Upload } from "lucide-react";
import Link from "next/link";

interface ContentItem {
  id: string;
  page: string;
  section: string;
  field_key: string;
  field_value: string | null;
  field_type: string;
  sort_order: number;
}

const sectionLabels: Record<string, string> = {
  hero: "히어로 섹션",
  about: "소개 섹션",
  groups: "너트 섹션",
  join: "가입 섹션",
  footer: "푸터",
  ticker: "티커",
  video: "영상 섹션",
  site: "사이트 설정 (로고/이름)",
  scene_space: "Scene — Space",
  scene_culture: "Scene — Culture",
  scene_platform: "Scene — Platform",
  scene_vibe: "Scene — Vibe",
};

export default function EditContentPage() {
  const params = useParams();
  const slug = params.section as string;
  const [page, section] = slug.split("__");
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("page_content")
        .select("*")
        .eq("page", page)
        .eq("section", section)
        .order("sort_order");
      setItems(data || []);
    }
    load();
  }, [page, section]);

  function updateValue(id: string, value: string) {
    setItems(items.map((item) => (item.id === id ? { ...item, field_value: value } : item)));
  }

  async function handleSave() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    for (const item of items) {
      await supabase
        .from("page_content")
        .update({ field_value: item.field_value, updated_at: new Date().toISOString(), updated_by: user?.id })
        .eq("id", item.id);
    }

    toast.success("콘텐츠가 저장되었습니다");
    setLoading(false);
  }

  async function handleImageUpload(itemId: string, file: File) {
    setUploading(itemId);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const fileName = `${section}_${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from("media").upload(fileName, file, { cacheControl: "3600", upsert: false });
    if (error) {
      toast.error("업로드 실패: " + error.message);
      setUploading(null);
      return;
    }

    const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);
    updateValue(itemId, urlData.publicUrl);
    toast.success("이미지 업로드 완료");
    setUploading(null);
  }

  async function handleAddField() {
    const key = prompt("필드 키를 입력하세요 (예: new_title)");
    if (!key) return;
    const fieldType = prompt("필드 타입 (text / image / json / richtext)", "text");
    if (!fieldType) return;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("page_content")
      .insert({ page, section, field_key: key, field_value: "", field_type: fieldType, sort_order: items.length })
      .select()
      .single();

    if (error) { toast.error(error.message); return; }
    if (data) { setItems([...items, data]); toast.success("필드가 추가되었습니다"); }
  }

  function isImageField(item: ContentItem) {
    return item.field_type === "image" || item.field_key.includes("image") || item.field_key.includes("logo") || item.field_key.includes("thumbnail");
  }

  function isVideoField(item: ContentItem) {
    return item.field_key.includes("video_url");
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      <Link href="/admin/content" className="inline-flex items-center gap-1 font-mono-nu text-[13px] uppercase tracking-widest text-nu-muted no-underline hover:text-nu-ink mb-6">
        <ArrowLeft size={14} /> 콘텐츠 목록
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-head text-3xl font-extrabold text-nu-ink">
            {sectionLabels[section] || section}
          </h1>
          <p className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mt-1">
            {page} / {section}
          </p>
        </div>
        <Button onClick={handleSave} disabled={loading} className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[13px] uppercase tracking-widest inline-flex items-center gap-2">
          <Save size={14} />
          {loading ? "저장 중..." : "저장"}
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <div key={item.id} className="bg-nu-white border border-nu-ink/[0.08] p-5">
            <Label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray mb-2 flex items-center gap-2">
              {isImageField(item) && <ImageIcon size={12} className="text-nu-blue" />}
              {isVideoField(item) && <Video size={12} className="text-nu-pink" />}
              {item.field_key}
              <span className="text-nu-muted">({item.field_type})</span>
            </Label>

            {/* Image field */}
            {isImageField(item) ? (
              <div>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Input
                      value={item.field_value || ""}
                      onChange={(e) => updateValue(item.id, e.target.value)}
                      placeholder="이미지 URL을 입력하거나 파일을 업로드하세요"
                      className="border-nu-ink/15 bg-transparent"
                    />
                  </div>
                  <label className="shrink-0 cursor-pointer font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2.5 border border-nu-ink/15 text-nu-graphite hover:bg-nu-cream transition-colors inline-flex items-center gap-1.5">
                    <Upload size={12} />
                    {uploading === item.id ? "업로드중..." : "파일선택"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(item.id, file);
                      }}
                    />
                  </label>
                </div>
                {/* Image preview */}
                {item.field_value && (
                  <div className="mt-3 relative inline-block">
                    <img src={item.field_value} alt="미리보기" className="max-h-40 border border-nu-ink/10 object-contain bg-nu-cream" />
                  </div>
                )}
              </div>
            ) : isVideoField(item) ? (
              <div>
                <Input
                  value={item.field_value || ""}
                  onChange={(e) => updateValue(item.id, e.target.value)}
                  placeholder="YouTube 또는 Vimeo URL (예: https://youtube.com/watch?v=...)"
                  className="border-nu-ink/15 bg-transparent"
                />
                {item.field_value && (
                  <p className="font-mono-nu text-[11px] text-green-600 mt-1.5">
                    영상 URL이 설정되었습니다. 저장하면 랜딩페이지에 반영됩니다.
                  </p>
                )}
              </div>
            ) : item.field_type === "richtext" || (item.field_value && item.field_value.length > 100) ? (
              <Textarea
                value={item.field_value || ""}
                onChange={(e) => updateValue(item.id, e.target.value)}
                rows={4}
                className="border-nu-ink/15 bg-transparent resize-none"
              />
            ) : item.field_type === "json" ? (
              <Textarea
                value={item.field_value || ""}
                onChange={(e) => updateValue(item.id, e.target.value)}
                rows={6}
                className="border-nu-ink/15 bg-transparent font-mono-nu text-xs resize-none"
              />
            ) : (
              <Input
                value={item.field_value || ""}
                onChange={(e) => updateValue(item.id, e.target.value)}
                className="border-nu-ink/15 bg-transparent"
              />
            )}
          </div>
        ))}
      </div>

      <button onClick={handleAddField} className="mt-4 font-mono-nu text-[13px] uppercase tracking-widest text-nu-pink hover:underline">
        + 새 필드 추가
      </button>
    </div>
  );
}
