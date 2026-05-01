import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/duplicate-bolts — 동일한 description 을 가진 볼트 그룹 검출.
 * 관리자가 즉시 개별화해야 할 볼트 리스트.
 */
export const GET = withRouteLog("admin.duplicate-bolts", async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, description, created_at")
    .neq("description", null)
    .order("created_at", { ascending: false })
    .limit(500);

  // description 을 해시 키로 묶기 (처음 100자 기준 — 템플릿 공통 구간 탐지)
  const groups = new Map<string, any[]>();
  for (const p of projects || []) {
    const key = (p.description || "").trim().slice(0, 100);
    if (!key) continue;
    const arr = groups.get(key) || [];
    arr.push(p);
    groups.set(key, arr);
  }

  const duplicates = [...groups.entries()]
    .filter(([_, arr]) => arr.length > 1)
    .map(([key, arr]) => ({
      excerpt: key,
      count: arr.length,
      bolts: arr.map((p) => ({ id: p.id, title: p.title, created_at: p.created_at })),
    }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    total: projects?.length ?? 0,
    duplicate_groups: duplicates.length,
    affected_bolts: duplicates.reduce((s, g) => s + g.count, 0),
    groups: duplicates,
  });
});
