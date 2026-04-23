/**
 * PATCH /api/groups/[id]/members/[memberId]
 *  body: { action: "approve" | "reject" }
 *
 * 너트 가입 신청 승인/거절 (호스트만). 채팅방 시스템 메시지에서 버튼으로 호출.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { dispatchEvent } from "@/lib/automation/engine";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; memberId: string }> };

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id: groupId, memberId: applicantId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const admin = getAdminClient() || supabase;

  // 호스트 권한 확인
  const { data: group } = await admin
    .from("groups")
    .select("host_id, name")
    .eq("id", groupId)
    .maybeSingle();
  if (!group) return NextResponse.json({ error: "group not found" }, { status: 404 });
  if ((group as any).host_id !== auth.user.id) {
    return NextResponse.json({ error: "호스트만 승인할 수 있어요" }, { status: 403 });
  }

  if (action === "approve") {
    const { error } = await admin
      .from("group_members")
      .update({ status: "active" })
      .eq("group_id", groupId)
      .eq("user_id", applicantId)
      .eq("status", "pending");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 승인 알림
    await admin.from("notifications").insert({
      user_id: applicantId,
      type: "join_approved",
      title: "너트 가입 승인됐어요 🎉",
      body: `${(group as any).name} 너트에 참여하게 됐어요. 지금 둘러보세요!`,
      metadata: { group_id: groupId },
      is_read: false,
    });

    // Nut-mation dispatch (non-fatal)
    try {
      await dispatchEvent("group.member_joined", {
        group_id: groupId,
        user_id: applicantId,
      });
    } catch (e: any) {
      console.warn("[members.approve] automation dispatch failed", e?.message);
    }
  } else {
    const { error } = await admin
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", applicantId)
      .eq("status", "pending");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await admin.from("notifications").insert({
      user_id: applicantId,
      type: "join_rejected",
      title: "너트 가입이 반려됐어요",
      body: `${(group as any).name} 너트 가입 신청이 반려됐습니다.`,
      metadata: { group_id: groupId },
      is_read: false,
    });
  }

  return NextResponse.json({ ok: true, action });
}
