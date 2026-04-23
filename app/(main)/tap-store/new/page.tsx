"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ShoppingBag, Plus, X, Tag, Upload, Eye } from "lucide-react";

type ProductType = "template" | "report" | "course" | "dataset" | "ebook" | "other";

const TYPE_META: Record<ProductType, { emoji: string; label: string; hint: string }> = {
  template:  { emoji: "📐", label: "템플릿",   hint: "노션/피그마/시트 템플릿" },
  report:    { emoji: "📊", label: "리포트",   hint: "분석 보고서·리서치" },
  course:    { emoji: "🎓", label: "코스",     hint: "강의·워크숍 영상" },
  dataset:   { emoji: "🗃", label: "데이터셋", hint: "가공된 데이터·DB" },
  ebook:     { emoji: "📖", label: "전자책",   hint: "가이드북·매뉴얼" },
  other:     { emoji: "✨", label: "기타",     hint: "자유 형태" },
};

export default function TapStoreNewPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [productType, setProductType] = useState<ProductType>("template");
  const [price, setPrice] = useState(0);
  const [coverUrl, setCoverUrl] = useState("");
  const [previewMd, setPreviewMd] = useState("");
  const [fullContentMd, setFullContentMd] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<{ url: string; name: string; size?: number }[]>([]);
  const [fileUrl, setFileUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login?redirectTo=/tap-store/new"); return; }
      setUserId(user.id);
    })();
  }, [router]);

  function addTag(s: string) {
    const clean = s.trim().replace(/,$/, "");
    if (!clean) return;
    if (tags.includes(clean)) return;
    if (tags.length >= 10) return toast.error("태그는 최대 10개까지");
    setTags([...tags, clean]);
    setTagInput("");
  }
  function removeTag(s: string) { setTags(tags.filter((x) => x !== s)); }

  function addFile() {
    if (!fileUrl.trim() || !fileName.trim()) return toast.error("파일 URL과 이름을 입력해주세요");
    setAttachedFiles([...attachedFiles, { url: fileUrl.trim(), name: fileName.trim() }]);
    setFileUrl(""); setFileName("");
  }
  function removeFile(i: number) { setAttachedFiles(attachedFiles.filter((_, idx) => idx !== i)); }

  async function submit() {
    if (!userId) return;
    if (!title.trim()) return toast.error("제목을 입력해주세요");
    if (price < 0) return toast.error("가격은 0원 이상");
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("tap_products").insert({
      seller_id: userId,
      title: title.trim(),
      summary: summary.trim() || null,
      product_type: productType,
      price,
      currency: "KRW",
      cover_url: coverUrl.trim() || null,
      preview_md: previewMd.trim() || null,
      full_content_md: fullContentMd.trim() || null,
      tags,
      attached_files: attachedFiles,
      status,
    }).select("id").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(status === "published" ? "상품이 공개됐습니다" : "초안으로 저장됐습니다");
    router.push(`/tap-store/${data.id}`);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 pb-20">
      <Link href="/tap-store" className="inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline mb-6">
        <ArrowLeft size={11} /> 탭 스토어
      </Link>

      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-6 flex items-center gap-2">
        <ShoppingBag size={24} className="text-nu-pink" /> 상품 등록
      </h1>

      <div className="border-l-[3px] border-nu-pink bg-nu-pink/5 p-3 mb-6">
        <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink font-bold mb-1">수익 분배</p>
        <p className="text-[12px] text-nu-graphite leading-relaxed">
          창작자 <strong className="text-nu-ink">90%</strong> · 플랫폼 수수료 <strong>10%</strong>. 볼트 내 거래는 수수료 별도 설정 가능.
        </p>
      </div>

      <div className="space-y-5">
        {/* Type */}
        <div>
          <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted block mb-2">상품 타입</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(Object.entries(TYPE_META) as [ProductType, typeof TYPE_META[ProductType]][]).map(([k, m]) => (
              <button
                key={k}
                type="button"
                onClick={() => setProductType(k)}
                className={`p-3 border-[2px] text-left transition-colors ${
                  productType === k ? "border-nu-pink bg-nu-pink/5" : "border-nu-ink/15 hover:border-nu-ink/40"
                }`}
              >
                <div className="text-[22px] leading-none mb-1">{m.emoji}</div>
                <div className="font-mono-nu text-[11px] font-bold uppercase">{m.label}</div>
                <div className="font-mono-nu text-[9px] text-nu-graphite">{m.hint}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Title / Summary */}
        <div>
          <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted block mb-1">제목 *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: LH 사회주택 공급모델 분석 템플릿 v2"
            maxLength={100}
            className="w-full px-3 py-2 border-[2px] border-nu-ink/20 text-sm focus:border-nu-pink outline-none"
          />
        </div>

        <div>
          <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted block mb-1">요약 (카드에 표시)</label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="한두 문장으로 상품의 가치 제안"
            rows={2}
            maxLength={200}
            className="w-full px-3 py-2 border-[2px] border-nu-ink/20 text-sm focus:border-nu-pink outline-none resize-none"
          />
        </div>

        {/* Price */}
        <div>
          <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted block mb-1">가격 (원)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step={1000}
              min={0}
              value={price || ""}
              onChange={(e) => setPrice(Number(e.target.value) || 0)}
              placeholder="0 = 무료"
              className="flex-1 px-3 py-2 border-[2px] border-nu-ink/20 text-sm tabular-nums focus:border-nu-pink outline-none"
            />
            <span className="font-mono-nu text-[11px] text-nu-graphite">
              순수익: ₩{Math.round(price * 0.9).toLocaleString("ko-KR")}
            </span>
          </div>
        </div>

        {/* Cover */}
        <div>
          <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted block mb-1">커버 이미지 URL (선택)</label>
          <input
            type="url"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2 border-[2px] border-nu-ink/20 text-sm focus:border-nu-pink outline-none"
          />
          {coverUrl && (
            <div className="mt-2 aspect-[3/2] max-w-sm bg-nu-ink/5 overflow-hidden">
              <img src={coverUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        {/* Tags */}
        <div>
          <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted block mb-1">
            <Tag size={10} className="inline mr-1" /> 태그 ({tags.length}/10)
          </label>
          <div className="flex flex-wrap gap-1 mb-1">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 font-mono-nu text-[11px] px-2 py-1 bg-nu-pink/10 border border-nu-pink/30 text-nu-pink">
                {t}
                <button type="button" onClick={() => removeTag(t)} aria-label={`${t} 제거`}><X size={10} /></button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => {
              const v = e.target.value;
              if (v.endsWith(",") || v.endsWith(" ")) addTag(v);
              else setTagInput(v);
            }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }}
            placeholder="Enter 또는 쉼표로 추가 (예: LH, 사회주택, 공급모델)"
            className="w-full px-3 py-2 border-[2px] border-nu-ink/20 text-sm focus:border-nu-pink outline-none"
          />
        </div>

        {/* Preview */}
        <div>
          <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted block mb-1">
            <Eye size={10} className="inline mr-1" /> 미리보기 (비구매자에게 노출)
          </label>
          <textarea
            value={previewMd}
            onChange={(e) => setPreviewMd(e.target.value)}
            placeholder="무료로 공개할 내용 — 구매 결정을 도울 샘플·목차·핵심 인사이트"
            rows={5}
            className="w-full px-3 py-2 border-[2px] border-nu-ink/20 text-sm font-mono focus:border-nu-pink outline-none resize-y"
          />
        </div>

        {/* Full content */}
        <div>
          <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted block mb-1">본문 (구매자만 접근)</label>
          <textarea
            value={fullContentMd}
            onChange={(e) => setFullContentMd(e.target.value)}
            placeholder="구매 후 열람 가능한 전체 콘텐츠 (Markdown)"
            rows={8}
            className="w-full px-3 py-2 border-[2px] border-nu-ink/20 text-sm font-mono focus:border-nu-pink outline-none resize-y"
          />
        </div>

        {/* Attached files */}
        <div>
          <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted block mb-1">
            <Upload size={10} className="inline mr-1" /> 첨부 파일 (구매자만 다운로드)
          </label>
          <div className="space-y-1 mb-2">
            {attachedFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1 bg-nu-cream/30 border border-nu-ink/10">
                <span className="font-mono-nu text-[11px] text-nu-ink flex-1 truncate">📎 {f.name}</span>
                <button type="button" onClick={() => removeFile(i)} aria-label="제거" className="text-nu-muted hover:text-red-500"><X size={11} /></button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[1fr,1fr,auto] gap-1">
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="파일 이름"
              className="px-2 py-1 border-[2px] border-nu-ink/20 text-[12px] focus:border-nu-pink outline-none"
            />
            <input
              type="url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://... (Drive/Dropbox 공유 링크)"
              className="px-2 py-1 border-[2px] border-nu-ink/20 text-[12px] focus:border-nu-pink outline-none"
            />
            <button type="button" onClick={addFile} className="px-3 py-1 bg-nu-ink text-nu-paper font-mono-nu text-[10px] uppercase inline-flex items-center gap-1">
              <Plus size={10} /> 추가
            </button>
          </div>
        </div>

        {/* Status + Submit */}
        <div className="flex items-center gap-2 pt-4 border-t-[2px] border-nu-ink/10">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={status === "published"} onChange={(e) => setStatus(e.target.checked ? "published" : "draft")} className="accent-nu-pink" />
            <span className="font-mono-nu text-[11px] uppercase tracking-widest">즉시 공개</span>
          </label>
          <span className="font-mono-nu text-[10px] text-nu-muted ml-auto">
            {status === "published" ? "✅ 탭 스토어에 노출됩니다" : "💾 초안 — 나중에 수정 후 공개 가능"}
          </span>
        </div>

        <button
          onClick={submit}
          disabled={saving || !title.trim()}
          className="w-full py-3 bg-nu-pink text-nu-paper font-mono-nu text-[12px] font-bold uppercase tracking-widest hover:bg-nu-pink/90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <ShoppingBag size={14} />}
          {status === "published" ? "공개하기" : "초안 저장"}
        </button>
      </div>
    </div>
  );
}
