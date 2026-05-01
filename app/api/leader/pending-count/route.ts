/**
 * GET /api/leader/pending-count
 *
 * 현재 로그인 유저가 호스트/리더인 영역의 **처리 대기** 항목 집계:
 *  - 내가 host 인 너트의 pending 가입 신청 수
 *  - 내가 created_by 인 볼트의 pending 지원서 수
 *  - 내가 승인권 가진 영역의 pending 정산 수
 *
 * 응답: { join_requests, project_applications, settlements, total }
 */

import { NextResponse } from "next/server";
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

export const GET = withRouteLog("leader.pending-count", async () => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ total: 0, join_requests: 0, project_applications: 0, settlements: 0 });
  }
  const uid = auth.user.id;
  const admin = getAdmin() || supabase;

  // 내가 호스트인 너트 IDs
  const { data: myGroups } = await admin
    .from("groups")
    .select("id")
    .eq("host_id", uid);
  const myGroupIds = ((myGroups as any[]) || []).map((g) => g.id);

  // 내가 created_by 인 볼트 IDs
  const { data: myProjects } = await admin
    .from("projects")
    .select("id")
    .eq("created_by", uid);
  const myProjectIds = ((myProjects as any[]) || []).map((p) => p.id);

  // 병렬 집계
  const [joinReqRes, appRes, settleRes] = await Promise.all([
    myGroupIds.length > 0
      ? admin
          .from("group_members")
          .select("user_id", { count: "exact", head: true })
          .in("group_id", myGroupIds)
          .eq("status", "pending")
      : Promise.resolve({ count: 0 } as any),
    myProjectIds.length > 0
      ? admin
          .from("project_applications")
          .select("id", { count: "exact", head: true })
          .in("project_id", myProjectIds)
          .eq("status", "pending")
      : Promise.resolve({ count: 0 } as any),
    (myGroupIds.length > 0 || myProjectIds.length > 0)
      ? (async () => {
          try {
            const filter = [
              myGroupIds.length > 0 ? `group_id.in.(${myGroupIds.join(",")})` : "",
              myProjectIds.length > 0 ? `project_id.in.(${myProjectIds.join(",")})` : "",
            ].filter(Boolean).join(",");
            const r = await admin
              .from("settlements")
              .select("id", { count: "exact", head: true })
              .or(filter)
              .eq("status", "pending");
            return r;
          } catch {
            return { count: 0 } as any;
          }
        })()
      : Promise.resolve({ count: 0 } as any),
  ]);

  const join_requests = (joinReqRes as any)?.count || 0;
  const project_applications = (appRes as any)?.count || 0;
  const settlements = (settleRes as any)?.count || 0;

  return NextResponse.json({
    total: join_requests + project_applications + settlements,
    join_requests,
    project_applications,
    settlements,
  });
});
