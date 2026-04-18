import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "nodejs";

const Schema = z.object({
  target_id: z.string().uuid(),
  relation: z.enum(["related", "extends", "combines", "cites", "replaces", "sequel"]).default("related"),
  note: z.string().max(500).optional(),
});

/** POST /api/wiki/[pageId]/connect — 탭 ↔ 탭 관계 생성 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  if (parsed.data.target_id === pageId) return NextResponse.json({ error: "자기 자신 연결 불가" }, { status: 400 });

  const { error } = await supabase.from("wiki_page_connections").insert({
    source_id: pageId,
    target_id: parsed.data.target_id,
    relation: parsed.data.relation,
    note: parsed.data.note ?? null,
    created_by: user.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** DELETE — 연결 해제 (작성자 또는 admin) */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { target_id, relation } = body ?? {};
  if (!target_id) return NextResponse.json({ error: "target_id 필수" }, { status: 400 });

  const q = supabase.from("wiki_page_connections").delete()
    .eq("source_id", pageId).eq("target_id", target_id);
  if (relation) q.eq("relation", relation);
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
