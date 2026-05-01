import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

// Helper: verify admin
async function verifyAdmin(supabase: any) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile?.role === "admin" ? user : null;
}

// GET: 전체 의뢰 목록 (관리자)
export const GET = withRouteLog("challenges.admin.get", async () => {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) {
      return NextResponse.json({ error: "관리자 권한이 필요합니다" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("challenge_proposals")
      .select(
        "*, submitter:profiles!challenge_proposals_submitted_by_fkey(nickname, email, avatar_url), pm:profiles!challenge_proposals_assigned_pm_id_fkey(nickname, email), project:projects!challenge_proposals_converted_project_id_fkey(id, title, status)"
      )
      .order("created_at", { ascending: false });

    if (error) {
      // Fallback without FK joins
      const { data: fallback } = await supabase
        .from("challenge_proposals")
        .select("*")
        .order("created_at", { ascending: false });

      return NextResponse.json({ proposals: fallback || [] });
    }

    return NextResponse.json({ proposals: data || [] });
  } catch (err: any) {
    log.error(err, "challenges.admin.failed");
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});

// PATCH: 의뢰 상태 업데이트 (관리자)
export const PATCH = withRouteLog("challenges.admin.patch", async (request: NextRequest) => {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) {
      return NextResponse.json({ error: "관리자 권한이 필요합니다" }, { status: 403 });
    }

    const body = await request.json();
    const { proposalId, action, adminNotes, rejectReason, assignedPmId } = body;

    if (!proposalId || !action) {
      return NextResponse.json({ error: "proposalId와 action이 필요합니다" }, { status: 400 });
    }

    // Fetch current proposal
    const { data: proposal, error: fetchErr } = await supabase
      .from("challenge_proposals")
      .select("*")
      .eq("id", proposalId)
      .single();

    if (fetchErr || !proposal) {
      return NextResponse.json({ error: "의뢰를 찾을 수 없습니다" }, { status: 404 });
    }

    switch (action) {
      case "review": {
        // submitted → reviewing
        await supabase
          .from("challenge_proposals")
          .update({ status: "reviewing", admin_notes: adminNotes || null })
          .eq("id", proposalId);
        return NextResponse.json({ success: true, status: "reviewing" });
      }

      case "reject": {
        await supabase
          .from("challenge_proposals")
          .update({
            status: "rejected",
            reject_reason: rejectReason || null,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", proposalId);
        return NextResponse.json({ success: true, status: "rejected" });
      }

      case "approve": {
        await supabase
          .from("challenge_proposals")
          .update({
            status: "approved",
            admin_notes: adminNotes || null,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", proposalId);
        return NextResponse.json({ success: true, status: "approved" });
      }

      case "convert": {
        // Convert to project
        const { data: project, error: projErr } = await supabase
          .from("projects")
          .insert({
            title: proposal.project_title,
            description: proposal.description || `의뢰: ${proposal.company_name}`,
            category: "challenge",
            status: "active",
            created_by: assignedPmId || admin.id,
          })
          .select("id")
          .single();

        if (projErr) {
          return NextResponse.json(
            { error: "프로젝트 생성 실패: " + projErr.message },
            { status: 500 }
          );
        }

        // Add PM as lead member if assigned
        if (assignedPmId) {
          await supabase.from("project_members").insert({
            project_id: project.id,
            user_id: assignedPmId,
            role: "lead",
          });
        }

        // Update proposal
        await supabase
          .from("challenge_proposals")
          .update({
            status: "converted",
            converted_project_id: project.id,
            assigned_pm_id: assignedPmId || null,
            reviewed_at: new Date().toISOString(),
            admin_notes: adminNotes || null,
          })
          .eq("id", proposalId);

        return NextResponse.json({
          success: true,
          status: "converted",
          projectId: project.id,
        });
      }

      default:
        return NextResponse.json({ error: "알 수 없는 action입니다" }, { status: 400 });
    }
  } catch (err: any) {
    log.error(err, "challenges.admin.failed");
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
