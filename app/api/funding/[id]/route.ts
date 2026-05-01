import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { dispatchPushToUsers } from "@/lib/push/dispatch";

export const runtime = "nodejs";

const UpdateSchema = z.object({
  status: z.enum(["draft","submitted","reviewing","funded","rejected","withdrawn"]),
  review_note: z.string().max(2000).optional(),
});

/** PATCH /api/funding/[id] — admin/staff 만 상태 변경 */
export const PATCH = withRouteLog("funding.id", async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const updates: Record<string, unknown> = {
    status: parsed.data.status,
    reviewer_id: user.id,
  };
  if (parsed.data.review_note !== undefined) updates.review_note = parsed.data.review_note;
  if (["funded","rejected"].includes(parsed.data.status)) {
    updates.decided_at = new Date().toISOString();
  }

  // 변경 전 상태 조회 (결정 push 발송 대상 확인)
  const { data: before } = await supabase
    .from("funding_submissions")
    .select("project_id, submitter_id, status, plan:venture_plans(content)")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("funding_submissions").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // funded / rejected 로 "전환" 된 경우에만 푸시 발송
  const newStatus = parsed.data.status;
  if (before && (newStatus === "funded" || newStatus === "rejected") && before.status !== newStatus) {
    // 대상: 제출자 + 프로젝트 멤버 + 프로젝트 호스트
    const { data: members } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", before.project_id as string);
    const { data: project } = await supabase
      .from("projects")
      .select("created_by, title")
      .eq("id", before.project_id as string)
      .maybeSingle();

    const userIds = new Set<string>();
    if (before.submitter_id) userIds.add(before.submitter_id as string);
    const createdBy = (project as { created_by?: string } | null)?.created_by;
    if (createdBy) userIds.add(createdBy);
    for (const m of (members as { user_id: string }[] | null) ?? []) userIds.add(m.user_id);

    if (userIds.size > 0) {
      // 비동기 발송 — 응답 지연 최소화
      dispatchPushToUsers([...userIds], {
        title: newStatus === "funded" ? "✅ 펀딩 결정" : "❌ 펀딩 반려",
        body: newStatus === "funded"
          ? `"${project?.title ?? "프로젝트"}" 펀딩이 결정되었습니다.`
          : `"${project?.title ?? "프로젝트"}" 펀딩이 반려되었습니다.${parsed.data.review_note ? ` 사유: ${parsed.data.review_note.slice(0, 80)}` : ""}`,
        url: `/projects/${before.project_id}/venture`,
        tag: `funding-${id}`,
      }).catch((e) => console.warn("[funding push]", e));
    }
  }

  return NextResponse.json({ success: true });
});
