import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog, extractRequestMeta } from "@/lib/finance/audit-log";

/**
 * POST /api/finance/approvals/[id]
 * action: approve | reject | cancel
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("id,role,nickname").eq("id", user.id).single();
    if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const isAdminStaff = profile.role === "admin" || profile.role === "staff";

    const body = await req.json();
    const action = body.action as string;
    const rejectReason = body.reject_reason as string | undefined;

    const { data: approval } = await supabase.from("approvals").select("*").eq("id", id).single();
    if (!approval) return NextResponse.json({ error: "결재 없음" }, { status: 404 });

    const today = new Date().toISOString().slice(0, 10);
    const meta = extractRequestMeta(req);

    if (action === "approve") {
      if (!isAdminStaff) return NextResponse.json({ error: "승인 권한 없음" }, { status: 403 });
      if (approval.status !== "대기") return NextResponse.json({ error: "이미 처리된 결재입니다" }, { status: 400 });
      const { error } = await supabase.from("approvals").update({
        status: "승인",
        approve_date: today,
        approver_id: profile.id,
        approver_name: profile.nickname,
      }).eq("id", id);
      if (error) return NextResponse.json({ error: "승인 실패" }, { status: 500 });

      await writeAuditLog(supabase, user, {
        entity_type: "approval",
        entity_id: id,
        action: "approve",
        company: approval.company ?? null,
        summary: `결재 승인: ${approval.title ?? ""}`,
        diff: { before: { status: approval.status }, after: { status: "승인" } },
        actor_role: profile.role,
      }, meta);

      return NextResponse.json({ success: true, status: "승인" });
    }

    if (action === "reject") {
      if (!isAdminStaff) return NextResponse.json({ error: "반려 권한 없음" }, { status: 403 });
      if (approval.status !== "대기") return NextResponse.json({ error: "이미 처리된 결재입니다" }, { status: 400 });
      const { error } = await supabase.from("approvals").update({
        status: "반려",
        approve_date: today,
        approver_id: profile.id,
        approver_name: profile.nickname,
        reject_reason: rejectReason || null,
      }).eq("id", id);
      if (error) return NextResponse.json({ error: "반려 실패" }, { status: 500 });

      await writeAuditLog(supabase, user, {
        entity_type: "approval",
        entity_id: id,
        action: "reject",
        company: approval.company ?? null,
        summary: `결재 반려: ${approval.title ?? ""}${rejectReason ? ` (사유: ${rejectReason})` : ""}`,
        diff: { before: { status: approval.status }, after: { status: "반려", reject_reason: rejectReason } },
        actor_role: profile.role,
      }, meta);

      return NextResponse.json({ success: true, status: "반려" });
    }

    if (action === "cancel") {
      // 요청자 본인만 취소 가능
      if (approval.requester_id !== profile.id && !isAdminStaff) {
        return NextResponse.json({ error: "취소 권한 없음" }, { status: 403 });
      }
      if (approval.status !== "대기") return NextResponse.json({ error: "이미 처리된 결재입니다" }, { status: 400 });
      const { error } = await supabase.from("approvals").delete().eq("id", id);
      if (error) return NextResponse.json({ error: "취소 실패" }, { status: 500 });

      await writeAuditLog(supabase, user, {
        entity_type: "approval",
        entity_id: id,
        action: "cancel",
        company: approval.company ?? null,
        summary: `결재 취소: ${approval.title ?? ""}`,
        diff: { before: approval },
        actor_role: profile.role,
      }, meta);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "지원하지 않는 action" }, { status: 400 });
  } catch (err) {
    console.error("[Approvals action]", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
