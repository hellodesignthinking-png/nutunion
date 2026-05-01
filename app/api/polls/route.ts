/**
 * POST /api/polls
 *  body: { room_id, question, options: string[], message_id? }
 *  → polls 레코드 생성. 성공 시 { poll_id }
 *
 * 마이그레이션 091_polls_and_pins.sql 필요. 테이블 미존재 환경에선 501 반환.
 */

import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

export const POST = withRouteLog("polls", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const room_id = body?.room_id as string | undefined;
  const question = (body?.question as string | undefined)?.trim();
  const options = Array.isArray(body?.options) ? (body.options as string[]).map((s) => String(s).trim()).filter(Boolean) : [];

  if (!room_id || !question || options.length < 2) {
    return NextResponse.json({ error: "room_id + question + options (2개 이상) 필요" }, { status: 400 });
  }
  if (options.length > 6) {
    return NextResponse.json({ error: "옵션은 최대 6개" }, { status: 400 });
  }

  const admin = getAdmin() || supabase;

  const closesAt = body?.closes_at ? new Date(body.closes_at) : null;
  if (closesAt && Number.isNaN(closesAt.getTime())) {
    return NextResponse.json({ error: "invalid closes_at" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("polls")
    .insert({
      room_id,
      message_id: body?.message_id || null,
      created_by: auth.user.id,
      question,
      options,
      allow_multi: !!body?.allow_multi,
      closes_at: closesAt?.toISOString() || null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    // 테이블 없음 → 501
    if (/relation.*polls.*does not exist|PGRST205/.test(error.message)) {
      return NextResponse.json(
        { error: "polls 테이블 미생성 — 091 마이그레이션 실행 필요", code: "MIGRATION_PENDING" },
        { status: 501 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ poll_id: (data as any)?.id });
});
