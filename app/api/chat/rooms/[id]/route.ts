/**
 * GET /api/chat/rooms/[id] — 방 메타 (RLS 우회용 service_role 쿼리)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getAdminClient();
  const db = admin || supabase;

  // 권한 체크
  const { data: membership } = await db
    .from("chat_members")
    .select("room_id")
    .eq("room_id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "방 멤버가 아닙니다" }, { status: 403 });
  }

  const { data: room, error } = await db
    .from("chat_rooms")
    .select("id, type, name, group_id, project_id, group:groups(name, image_url), project:projects(title, image_url)")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[chat room GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ room });
}
