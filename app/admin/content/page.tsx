import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { FileText, ChevronRight, Image, Video, Type, Code, Palette } from "lucide-react";

export default async function ContentManagementPage() {
  const supabase = await createClient();

  const { data: content } = await supabase
    .from("page_content")
    .select("page, section, field_key, field_type, field_value")
    .order("page")
    .order("section")
    .order("sort_order");

  // Group by page > section with field counts
  const pages: Record<string, Record<string, { fields: number; images: number; hasVideo: boolean; preview: string }>> = {};
  content?.forEach((c) => {
    if (!pages[c.page]) pages[c.page] = {};
    if (!pages[c.page][c.section]) pages[c.page][c.section] = { fields: 0, images: 0, hasVideo: false, preview: "" };
    pages[c.page][c.section].fields++;
    if (c.field_type === "image" || c.field_key.includes("image") || c.field_key.includes("logo")) {
      pages[c.page][c.section].images++;
    }
    if (c.field_key.includes("video")) {
      pages[c.page][c.section].hasVideo = true;
    }
    if (!pages[c.page][c.section].preview && c.field_value && c.field_type === "text") {
      pages[c.page][c.section].preview = c.field_value.slice(0, 50);
    }
  });

  const sectionLabels: Record<string, string> = {
    site: "사이트 설정",
    hero: "히어로 (메인 배너)",
    about: "소개 섹션",
    groups: "소모임 섹션",
    join: "가입 유도 섹션",
    footer: "푸터",
    ticker: "티커 (흐르는 텍스트)",
    video: "영상 섹션",
    scene_space: "Scene — Space",
    scene_culture: "Scene — Culture",
    scene_platform: "Scene — Platform",
    scene_vibe: "Scene — Vibe",
  };

  const sectionIcons: Record<string, typeof FileText> = {
    site: Palette,
    hero: Image,
    video: Video,
    ticker: Code,
  };

  const sectionDescriptions: Record<string, string> = {
    site: "로고 이미지, 사이트 이름",
    hero: "메인 타이틀, 서브타이틀, CTA 버튼, 배경 이미지",
    about: "소개 벤토 그리드 — 텍스트, 숫자, 설명",
    groups: "소모임 섹션 타이틀, 설명",
    join: "가입 유도 타이틀, 설명",
    footer: "브랜드 텍스트, 저작권, 네비게이션 링크",
    ticker: "흐르는 키워드 목록 (JSON)",
    video: "YouTube/Vimeo URL, 영상 제목, 썸네일",
    scene_space: "공간 Scene 이미지, 제목, 설명",
    scene_culture: "문화 Scene 이미지, 제목",
    scene_platform: "플랫폼 Scene 이미지, 제목",
    scene_vibe: "바이브 Scene 이미지, 제목",
  };

  return (
    <div className="max-w-5xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-head text-3xl font-extrabold text-nu-ink">
            콘텐츠 관리
          </h1>
          <p className="text-nu-gray text-sm mt-1">
            랜딩 페이지의 모든 텍스트, 이미지, 영상을 수정할 수 있습니다
          </p>
        </div>
        <Link
          href="/admin/media"
          className="font-mono-nu text-[11px] uppercase tracking-widest px-5 py-3 bg-nu-ink text-nu-paper no-underline hover:bg-nu-pink transition-colors inline-flex items-center gap-2"
        >
          <Image size={14} /> 미디어 라이브러리
        </Link>
      </div>

      {/* Quick guide */}
      <div className="bg-nu-cream/50 border border-nu-ink/[0.06] p-5 mb-8">
        <h3 className="font-head text-sm font-bold text-nu-ink mb-2">사용 방법</h3>
        <ol className="text-xs text-nu-gray space-y-1 list-decimal list-inside leading-relaxed">
          <li><strong>미디어 라이브러리</strong>에서 이미지/영상을 먼저 업로드합니다</li>
          <li>아래 섹션을 클릭하여 <strong>텍스트, 이미지 URL, 영상 URL</strong>을 수정합니다</li>
          <li>이미지 필드에서는 직접 파일 업로드도 가능합니다</li>
          <li>저장하면 홈페이지에 즉시 반영됩니다</li>
        </ol>
      </div>

      {Object.entries(pages).map(([page, sections]) => (
        <div key={page} className="mb-10">
          <h2 className="font-head text-xl font-extrabold capitalize mb-4 flex items-center gap-2">
            {page === "landing" ? "🏠 랜딩 페이지" : page}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(sections).map(([section, info]) => {
              const Icon = sectionIcons[section] || FileText;
              return (
                <Link
                  key={section}
                  href={`/admin/content/${page}__${section}`}
                  className="bg-nu-white border border-nu-ink/[0.08] p-5 flex items-start gap-4 no-underline hover:border-nu-pink/30 hover:shadow-sm transition-all group"
                >
                  <div className="w-10 h-10 flex items-center justify-center bg-nu-cream shrink-0">
                    <Icon size={18} className="text-nu-muted group-hover:text-nu-pink transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-head text-sm font-bold text-nu-ink group-hover:text-nu-pink transition-colors">
                        {sectionLabels[section] || section}
                      </p>
                      <ChevronRight size={14} className="text-nu-muted shrink-0" />
                    </div>
                    <p className="text-[11px] text-nu-muted mt-0.5">
                      {sectionDescriptions[section] || ""}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="font-mono-nu text-[9px] text-nu-muted flex items-center gap-1">
                        <Type size={10} /> {info.fields} 필드
                      </span>
                      {info.images > 0 && (
                        <span className="font-mono-nu text-[9px] text-nu-blue flex items-center gap-1">
                          <Image size={10} /> {info.images} 이미지
                        </span>
                      )}
                      {info.hasVideo && (
                        <span className="font-mono-nu text-[9px] text-nu-pink flex items-center gap-1">
                          <Video size={10} /> 영상
                        </span>
                      )}
                    </div>
                    {info.preview && (
                      <p className="text-[10px] text-nu-muted/60 mt-1 truncate italic">
                        &ldquo;{info.preview}&rdquo;
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      {Object.keys(pages).length === 0 && (
        <div className="bg-nu-white border border-nu-ink/[0.08] p-12 text-center">
          <p className="text-nu-gray">콘텐츠 항목이 없습니다</p>
        </div>
      )}
    </div>
  );
}
