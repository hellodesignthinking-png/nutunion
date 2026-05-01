import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

export const POST = withRouteLog("threads.slug.reviews.post", async (req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad_json" }, { status: 400 });
  const { rating, comment } = body as { rating?: number; comment?: string };
  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "invalid_rating" }, { status: 400 });
  }

  const { data: thread } = await supabase.from("threads").select("id").eq("slug", slug).maybeSingle();
  if (!thread) return NextResponse.json({ error: "thread_not_found" }, { status: 404 });

  const { error } = await supabase
    .from("thread_reviews")
    .upsert({ thread_id: thread.id, user_id: user.id, rating, comment: comment || null }, { onConflict: "thread_id,user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Recompute avg
  const { data: rs } = await supabase.from("thread_reviews").select("rating").eq("thread_id", thread.id);
  const ratings = (rs || []).map((r: any) => r.rating);
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  await supabase.from("threads").update({ avg_rating: avg }).eq("id", thread.id);

  return NextResponse.json({ ok: true });
});

export const DELETE = withRouteLog("threads.slug.reviews.delete", async (_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: thread } = await supabase.from("threads").select("id").eq("slug", slug).maybeSingle();
  if (!thread) return NextResponse.json({ error: "thread_not_found" }, { status: 404 });

  const { error } = await supabase
    .from("thread_reviews")
    .delete()
    .eq("thread_id", thread.id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: rs } = await supabase.from("thread_reviews").select("rating").eq("thread_id", thread.id);
  const ratings = (rs || []).map((r: any) => r.rating);
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  await supabase.from("threads").update({ avg_rating: avg }).eq("id", thread.id);

  return NextResponse.json({ ok: true });
});
