import { NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/spaces/workspaces — 사용자가 접근 가능한 모든 너트/볼트.
 * 워크스페이스 스위처 — 사이드바에서 다른 너트/볼트로 빠르게 점프.
 */
export const GET = withRouteLog("spaces.workspaces", async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [nutsRes, boltsRes] = await Promise.all([
    supabase
      .from("group_members")
      .select("groups(id, name)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(50),
    supabase
      .from("project_members")
      .select("projects(id, title, status)")
      .eq("user_id", user.id)
      .limit(50),
  ]);

  const nuts = (nutsRes.data ?? [])
    .map((r: any) => r.groups)
    .filter(Boolean)
    .map((g: any) => ({
      kind: "nut" as const,
      id: g.id as string,
      name: g.name as string,
      href: `/groups/${g.id}`,
    }));

  const bolts = (boltsRes.data ?? [])
    .map((r: any) => r.projects)
    .filter(Boolean)
    .map((p: any) => ({
      kind: "bolt" as const,
      id: p.id as string,
      name: p.title as string,
      sub: p.status as string,
      href: `/projects/${p.id}`,
    }));

  return NextResponse.json({ nuts, bolts });
});
