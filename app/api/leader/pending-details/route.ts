/**
 * GET /api/leader/pending-details
 *
 * pending 건의 상세 링크 목록 (리더 배지에서 "각 방으로 바로가기" 용).
 * 응답:
 *  {
 *    join_requests:   [{ group_id, group_name, count, url }],
 *    project_applications: [{ project_id, project_title, count, url }],
 *    settlements:     [{ settlement_id, amount, currency, url }],
 *  }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ join_requests: [], project_applications: [], settlements: [] });
  }
  const uid = auth.user.id;
  const admin = getAdmin() || supabase;

  // 내가 host 인 너트들
  const { data: myGroups } = await admin
    .from("groups")
    .select("id, name")
    .eq("host_id", uid);

  // 내가 created_by 인 볼트들
  const { data: myProjects } = await admin
    .from("projects")
    .select("id, title")
    .eq("created_by", uid);

  const groupIds = ((myGroups as any[]) || []).map((g) => g.id);
  const projectIds = ((myProjects as any[]) || []).map((p) => p.id);

  // 가입 신청 — 그룹별 집계
  let joinRequests: Array<{ group_id: string; group_name: string; count: number; url: string }> = [];
  if (groupIds.length > 0) {
    const { data } = await admin
      .from("group_members")
      .select("group_id")
      .in("group_id", groupIds)
      .eq("status", "pending");
    const countMap = new Map<string, number>();
    for (const r of (data as any[]) || []) {
      countMap.set(r.group_id, (countMap.get(r.group_id) || 0) + 1);
    }
    joinRequests = ((myGroups as any[]) || [])
      .map((g) => ({
        group_id: g.id,
        group_name: g.name,
        count: countMap.get(g.id) || 0,
        url: `/groups/${g.id}`,
      }))
      .filter((x) => x.count > 0);
  }

  // 볼트 지원서 — 프로젝트별 집계
  let projectApplications: Array<{ project_id: string; project_title: string; count: number; url: string }> = [];
  if (projectIds.length > 0) {
    const { data } = await admin
      .from("project_applications")
      .select("project_id")
      .in("project_id", projectIds)
      .eq("status", "pending");
    const countMap = new Map<string, number>();
    for (const r of (data as any[]) || []) {
      countMap.set(r.project_id, (countMap.get(r.project_id) || 0) + 1);
    }
    projectApplications = ((myProjects as any[]) || [])
      .map((p) => ({
        project_id: p.id,
        project_title: p.title,
        count: countMap.get(p.id) || 0,
        url: `/projects/${p.id}`,
      }))
      .filter((x) => x.count > 0);
  }

  // 정산 — 개별 건별 (settlements 테이블 없을 수도 있음)
  let settlements: Array<{ settlement_id: string; amount: number; currency: string; url: string; context: string }> = [];
  try {
    if (groupIds.length > 0 || projectIds.length > 0) {
      const filter = [
        groupIds.length > 0 ? `group_id.in.(${groupIds.join(",")})` : "",
        projectIds.length > 0 ? `project_id.in.(${projectIds.join(",")})` : "",
      ].filter(Boolean).join(",");
      const { data } = await admin
        .from("settlements")
        .select("id, amount, currency, group_id, project_id")
        .or(filter)
        .eq("status", "pending")
        .limit(20);
      settlements = ((data as any[]) || []).map((s) => {
        const url = s.project_id ? `/projects/${s.project_id}` : s.group_id ? `/groups/${s.group_id}/finance` : "/notifications";
        const context = s.project_id
          ? ((myProjects as any[])?.find((p) => p.id === s.project_id)?.title || "볼트")
          : ((myGroups as any[])?.find((g) => g.id === s.group_id)?.name || "너트");
        return {
          settlement_id: s.id,
          amount: s.amount,
          currency: s.currency || "KRW",
          url,
          context,
        };
      });
    }
  } catch {}

  return NextResponse.json({ join_requests: joinRequests, project_applications: projectApplications, settlements });
}
