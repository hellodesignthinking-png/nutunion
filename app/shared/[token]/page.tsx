import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SharedPageRenderer } from "./shared-page-renderer";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
}

/**
 * 공개 페이지 — 인증 없이 share_token 으로 접근.
 * RLS: space_pages.share_token IS NOT NULL 일 때만 anon read.
 *
 * 페이지 chrome 없음 (no nav, no sidebar). 깨끗한 읽기 전용 뷰.
 */
export default async function SharedPage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: page } = await supabase
    .from("space_pages")
    .select("id, title, icon, content, shared_at")
    .eq("share_token", token)
    .maybeSingle();
  if (!page) notFound();

  const { data: blocks } = await supabase
    .from("space_page_blocks")
    .select("id, type, content, data, position")
    .eq("page_id", page.id)
    .order("position", { ascending: true });

  return (
    <div className="min-h-screen bg-nu-paper">
      <header className="border-b-[2px] border-nu-ink/15 bg-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{page.icon || "📄"}</span>
          <h1 className="font-head text-[18px] font-extrabold text-nu-ink">{page.title}</h1>
        </div>
        <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
          🔗 공유 페이지 · 읽기 전용
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-8">
        <SharedPageRenderer blocks={blocks ?? []} />
      </main>
      <footer className="border-t border-nu-ink/10 mt-12 px-6 py-4 text-center font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
        nutunion · {new Date(page.shared_at || Date.now()).toLocaleDateString("ko")} 공유
      </footer>
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("space_pages")
    .select("title, icon")
    .eq("share_token", token)
    .maybeSingle();
  return {
    title: data ? `${data.icon || "📄"} ${data.title}` : "공유 페이지",
    description: "nutunion 공유 페이지",
  };
}
