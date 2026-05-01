/**
 * PATCH /api/projects/[id]/applications/[applicantId]
 *  body: { action: "approve" | "reject" }
 *
 * 볼트 지원서 승인/거절 (리더만). 채팅방 ActionCard 에서 호출.
 */

import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { dispatchNotification } from "@/lib/notifications/dispatch";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; applicantId: string }> };

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

export const PATCH = withRouteLog("projects.id.applications.applicantId", async (req: NextRequest, { params }: Ctx) => {
  const { id: projectId, applicantId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const admin = getAdminClient() || supabase;

  // 리더 권한 확인
  const { data: proj } = await admin
    .from("projects")
    .select("created_by, title")
    .eq("id", projectId)
    .maybeSingle();
  if (!proj) return NextResponse.json({ error: "project not found" }, { status: 404 });
  if ((proj as any).created_by !== auth.user.id) {
    return NextResponse.json({ error: "리더만 승인할 수 있어요" }, { status: 403 });
  }

  // 지원서 status 업데이트
  const newStatus = action === "approve" ? "approved" : "rejected";
  const { error } = await admin
    .from("project_applications")
    .update({ status: newStatus, reviewed_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .eq("applicant_id", applicantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 승인이면 project_members 에 member 추가
  if (action === "approve") {
    await admin
      .from("project_members")
      .insert({
        project_id: projectId,
        user_id: applicantId,
        role: "member",
      })
      .select();
  }

  // 지원자 알림
  await dispatchNotification({
    recipientId: applicantId,
    eventType: action === "approve" ? "application_approved" : "application_rejected",
    title: action === "approve" ? "볼트 지원이 승인됐어요 🎉" : "볼트 지원이 반려됐어요",
    body: action === "approve"
      ? `${(proj as any).title} 볼트에 참여하게 됐어요!`
      : `${(proj as any).title} 볼트 지원이 반려됐습니다.`,
    linkUrl: `/projects/${projectId}`,
    metadata: { project_id: projectId },
  });

  return NextResponse.json({ ok: true, action });
});
