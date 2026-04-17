import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MarketingForm } from "@/components/finance/marketing-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI 마케팅" };

export default async function FinanceMarketingPage() {
  const supabase = await createClient();
  const [bolts, companies] = await Promise.all([
    supabase.from("projects").select("id,title,description,category,status").order("created_at", { ascending: false }),
    supabase.from("companies").select("id,name,label,biz_type,color,icon").order("created_at", { ascending: true }),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-8">
        <div className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-graphite mb-2">
          MARKETING · AI 콘텐츠 생성
        </div>
        <h1 className="text-[24px] sm:text-[32px] font-bold text-nu-ink leading-tight">
          AI 마케팅 콘텐츠
        </h1>
        <p className="text-[13px] text-nu-graphite mt-2">
          볼트(프로젝트) 또는 법인의 특성에 맞춘 마케팅 콘텐츠를 AI로 자동 생성합니다.
        </p>
      </div>

      <MarketingForm
        bolts={(bolts.data || []).map((b) => ({ id: b.id, title: b.title, description: b.description, category: b.category, status: b.status }))}
        companies={(companies.data || []).map((c) => ({ id: c.id, name: c.name, label: c.label, biz_type: c.biz_type, color: c.color, icon: c.icon }))}
      />
    </div>
  );
}
