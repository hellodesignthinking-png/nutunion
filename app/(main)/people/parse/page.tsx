import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ParseClient } from "@/components/people/parse-client";

export const dynamic = "force-dynamic";

export default async function ParsePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: people } = await supabase
    .from("people")
    .select("id, display_name, company")
    .eq("owner_id", user.id)
    .order("display_name", { ascending: true });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <Link href="/people" className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted no-underline inline-flex items-center gap-1 mb-4 hover:text-nu-ink">
        <ChevronLeft size={12} /> 인맥 목록
      </Link>
      <h1 className="font-head text-3xl font-extrabold text-nu-ink tracking-tight">카톡/문자 파싱</h1>
      <p className="font-mono-nu text-[13px] text-nu-muted uppercase tracking-widest mt-1 mb-6">
        AI 가 중요한 단서를 추출해드립니다
      </p>
      <ParseClient people={((people as any[]) || [])} />
    </div>
  );
}
