import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/threads/[slug] — thread meta + top reviews
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: thread, error } = await supabase
    .from("threads")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    if (/relation .* does not exist/i.test(error.message) || error.code === "42P01") {
      return NextResponse.json({ error: "migration_115_missing" }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!thread) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: reviews } = await supabase
    .from("thread_reviews")
    .select("id, rating, comment, created_at, user_id")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const { count: installCount } = await supabase
    .from("thread_installations")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", thread.id);

  return NextResponse.json({
    thread,
    reviews: reviews || [],
    install_count: installCount ?? 0,
  });
}
