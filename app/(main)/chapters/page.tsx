import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MapPin, Users, Rocket, ArrowRight, Sparkles } from "lucide-react";
import { PageHero } from "@/components/shared/page-hero";

export const dynamic = "force-dynamic";
export const metadata = { title: "City Chapter — nutunion 지방 챕터" };

export default async function ChaptersPage() {
  const supabase = await createClient();

  const { data: chapters } = await supabase
    .from("city_chapters")
    .select("id, slug, name_ko, name_en, description, cover_url, active, captain:profiles!city_chapters_captain_id_fkey(id, nickname, avatar_url)")
    .eq("active", true)
    .order("slug");

  // 각 챕터별 너트·볼트 카운트
  const rows = await Promise.all((chapters || []).map(async (c: any) => {
    const [{ count: groupCount }, { count: projectCount }] = await Promise.all([
      supabase.from("groups").select("id", { count: "exact", head: true }).eq("city_chapter_id", c.id).eq("is_active", true),
      supabase.from("projects").select("id", { count: "exact", head: true }).eq("city_chapter_id", c.id).eq("status", "active"),
    ]);
    return { ...c, groupCount: groupCount || 0, projectCount: projectCount || 0 };
  }));

  return (
    <div className="bg-nu-paper min-h-screen pb-20">
      <PageHero
        compact
        category="City Chapters"
        title="지방 챕터"
        description="서울을 넘어 제주, 부산, 대구까지. 각 도시의 크리에이티브 씬을 하나로 연결합니다."
        stats={[
          { label: "활성 챕터", value: `${rows.length}개`, icon: <MapPin size={12} /> },
        ]}
      />

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((c) => (
            <Link
              key={c.id}
              href={`/chapters/${c.slug}`}
              className="group border-[2.5px] border-nu-ink/10 hover:border-nu-pink bg-nu-paper p-4 no-underline transition-all"
            >
              {c.cover_url ? (
                <div className="aspect-[3/2] bg-nu-ink/5 overflow-hidden mb-3 -mx-4 -mt-4">
                  <img src={c.cover_url} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="aspect-[3/2] bg-gradient-to-br from-nu-pink/10 to-nu-blue/10 flex items-center justify-center mb-3 -mx-4 -mt-4">
                  <MapPin size={36} className="text-nu-pink/40" />
                </div>
              )}

              <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-1">
                {c.name_en}
              </div>
              <h3 className="font-head text-xl font-extrabold text-nu-ink group-hover:text-nu-pink">
                {c.name_ko}
              </h3>

              {c.description && (
                <p className="text-[12px] text-nu-graphite line-clamp-2 mt-1 leading-relaxed">{c.description}</p>
              )}

              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-nu-ink/10 font-mono-nu text-[10px] text-nu-graphite">
                <span className="flex items-center gap-0.5"><Users size={10} /> {c.groupCount}</span>
                <span className="flex items-center gap-0.5"><Rocket size={10} /> {c.projectCount}</span>
                {c.captain ? (
                  <span className="ml-auto flex items-center gap-1">
                    <Sparkles size={9} className="text-nu-amber" />
                    <span className="text-nu-ink font-bold">{c.captain.nickname}</span>
                  </span>
                ) : (
                  <span className="ml-auto text-nu-pink/70">챕터장 모집 중 →</span>
                )}
              </div>
            </Link>
          ))}

          {/* 챕터장 신청 CTA */}
          <div className="border-[2.5px] border-dashed border-nu-ink/20 p-4 flex flex-col justify-center items-center text-center bg-nu-cream/30">
            <Sparkles size={24} className="text-nu-amber mb-2" />
            <p className="font-bold text-[13px] text-nu-ink mb-1">챕터장이 되세요</p>
            <p className="text-[11px] text-nu-graphite mb-3 leading-relaxed">
              당신의 도시에서 nutunion 씬을 이끌어주세요. 월 활동 보조금·브랜드 지원 제공.
            </p>
            <a
              href="mailto:hello@nutunion.kr?subject=City Chapter 챕터장 신청"
              className="inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 bg-nu-amber text-nu-paper hover:bg-nu-amber/90 no-underline"
            >
              신청 <ArrowRight size={10} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
