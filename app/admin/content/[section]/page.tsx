"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
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

export default function EditContentPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.section as string;
  const [page, section] = slug.split("__");
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);

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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    for (const item of items) {
      await supabase
        .from("page_content")
        .update({
          field_value: item.field_value,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        })
        .eq("id", item.id);
    }

    toast.success("콘텐츠가 저장되었습니다");
    setLoading(false);
  }

  async function handleAddField() {
    const key = prompt("필드 키를 입력하세요 (예: new_title)");
    if (!key) return;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("page_content")
      .insert({
        page,
        section,
        field_key: key,
        field_value: "",
        field_type: "text",
        sort_order: items.length,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }
    if (data) {
      setItems([...items, data]);
      toast.success("필드가 추가되었습니다");
    }
  }

  const sectionLabels: Record<string, string> = {
    hero: "히어로 섹션",
    about: "소개 섹션",
    groups: "소모임 섹션",
    join: "가입 섹션",
    footer: "푸터",
    ticker: "티커",
  };

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      <Link
        href="/admin/content"
        className="inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted no-underline hover:text-nu-ink mb-6"
      >
        <ArrowLeft size={14} /> 콘텐츠 목록
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-head text-3xl font-extrabold text-nu-ink">
            {sectionLabels[section] || section}
          </h1>
          <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mt-1">
            {page} / {section}
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={loading}
          className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[11px] uppercase tracking-widest inline-flex items-center gap-2"
        >
          <Save size={14} />
          {loading ? "저장 중..." : "저장"}
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-nu-white border border-nu-ink/[0.08] p-5"
          >
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray mb-2 block">
              {item.field_key}
              <span className="ml-2 text-nu-muted">({item.field_type})</span>
            </Label>
            {item.field_type === "richtext" || (item.field_value && item.field_value.length > 100) ? (
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

      <button
        onClick={handleAddField}
        className="mt-4 font-mono-nu text-[11px] uppercase tracking-widest text-nu-pink hover:underline"
      >
        + 새 필드 추가
      </button>
    </div>
  );
}
