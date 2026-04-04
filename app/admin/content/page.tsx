import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { FileText, ChevronRight } from "lucide-react";

export default async function ContentManagementPage() {
  const supabase = await createClient();

  const { data: content } = await supabase
    .from("page_content")
    .select("page, section")
    .order("page")
    .order("section");

  // Group by page > section
  const pages: Record<string, Set<string>> = {};
  content?.forEach((c) => {
    if (!pages[c.page]) pages[c.page] = new Set();
    pages[c.page].add(c.section);
  });

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
      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-2">
        콘텐츠 관리
      </h1>
      <p className="text-nu-gray text-sm mb-8">
        랜딩 페이지와 서브 페이지의 모든 텍스트, 이미지를 수정할 수 있습니다.
      </p>

      {Object.entries(pages).map(([page, sections]) => (
        <div key={page} className="mb-8">
          <h2 className="font-head text-xl font-extrabold capitalize mb-4">
            {page === "landing" ? "랜딩 페이지" : page}
          </h2>
          <div className="flex flex-col gap-2">
            {Array.from(sections).map((section) => (
              <Link
                key={section}
                href={`/admin/content/${page}__${section}`}
                className="bg-nu-white border border-nu-ink/[0.08] p-5 flex items-center justify-between no-underline hover:border-nu-pink/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText size={18} className="text-nu-muted" />
                  <div>
                    <p className="font-head text-sm font-bold text-nu-ink">
                      {sectionLabels[section] || section}
                    </p>
                    <p className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest">
                      {page} / {section}
                    </p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-nu-muted" />
              </Link>
            ))}
          </div>
        </div>
      ))}

      {Object.keys(pages).length === 0 && (
        <div className="bg-nu-white border border-nu-ink/[0.08] p-8 text-center">
          <p className="text-nu-gray">콘텐츠 항목이 없습니다</p>
        </div>
      )}
    </div>
  );
}
