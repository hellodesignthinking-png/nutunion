import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

const MAX_BLOCKS = 100;

/** GET → { snippets: [...] } */
export const GET = withRouteLog("spaces.snippets.get", async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("space_snippets")
    .select("id, title, icon, blocks, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ snippets: data ?? [] });
});

/** POST  body: { title, icon?, blocks: [{type, content, data}, ...] } */
export const POST = withRouteLog("spaces.snippets.post", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    title?: string;
    icon?: string;
    blocks?: Array<Record<string, unknown>>;
  } | null;
  if (!body?.blocks || !Array.isArray(body.blocks) || body.blocks.length === 0) {
    return NextResponse.json({ error: "blocks_required" }, { status: 400 });
  }
  if (body.blocks.length > MAX_BLOCKS) {
    return NextResponse.json({ error: "too_many_blocks" }, { status: 413 });
  }
  const title = (body.title ?? "").trim().slice(0, 200) || "제목 없는 스니펫";
  const icon = (body.icon ?? "🧩").slice(0, 4);

  const { data, error } = await supabase
    .from("space_snippets")
    .insert({ user_id: user.id, title, icon, blocks: body.blocks })
    .select("id, title, icon, blocks, created_at, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ snippet: data });
});
