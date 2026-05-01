/**
 * GET /api/admin/storage/usage
 *
 * 그룹/프로젝트 별 R2 사용량 랭킹 + 방치된 Drive 사본 통계.
 * admin/staff 전용.
 */

import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export const GET = withRouteLog("admin.storage.usage", async (_req: NextRequest) => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profile?.role !== "admin" && profile?.role !== "staff") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    return NextResponse.json({ error: "service role missing" }, { status: 500 });
  }
  const svc = createServiceClient(url, key, { auth: { persistSession: false } });

  // 1) 그룹별 R2 합계 (file_attachments)
  const { data: groupRows } = await svc
    .from("file_attachments")
    .select("target_id, file_size, storage_type")
    .eq("target_type", "group")
    .eq("storage_type", "r2");

  const byGroup = new Map<string, { bytes: number; count: number }>();
  for (const r of groupRows || []) {
    const id = (r as any).target_id as string;
    const sz = ((r as any).file_size as number) || 0;
    const cur = byGroup.get(id) || { bytes: 0, count: 0 };
    cur.bytes += sz;
    cur.count += 1;
    byGroup.set(id, cur);
  }

  // 2) 그룹 메타 — 이름
  const groupIds = Array.from(byGroup.keys());
  const { data: groups } = groupIds.length > 0
    ? await svc.from("groups").select("id, name").in("id", groupIds)
    : { data: [] as any[] };
  const groupName = new Map((groups || []).map((g: any) => [g.id, g.name as string]));

  const groupRanking = Array.from(byGroup.entries())
    .map(([id, v]) => ({ id, name: groupName.get(id) || id, bytes: v.bytes, count: v.count }))
    .sort((a, b) => b.bytes - a.bytes);

  // 3) 프로젝트별 R2 합계 (project_resources 에는 file_size 가 없으면 file_attachments 와 다름 —
  //    project_resources 에 size 컬럼이 있다면 사용, 없으면 count 만)
  const { data: projRows } = await svc
    .from("project_resources")
    .select("project_id, storage_type")
    .eq("storage_type", "r2");
  const byProject = new Map<string, { count: number }>();
  for (const r of projRows || []) {
    const id = (r as any).project_id as string;
    const cur = byProject.get(id) || { count: 0 };
    cur.count += 1;
    byProject.set(id, cur);
  }
  const projIds = Array.from(byProject.keys());
  const { data: projects } = projIds.length > 0
    ? await svc.from("projects").select("id, title").in("id", projIds)
    : { data: [] as any[] };
  const projTitle = new Map((projects || []).map((p: any) => [p.id, p.title as string]));
  const projectRanking = Array.from(byProject.entries())
    .map(([id, v]) => ({ id, title: projTitle.get(id) || id, count: v.count }))
    .sort((a, b) => b.count - a.count);

  // 4) Drive 사본 통계 — file_drive_edits
  const { data: edits } = await svc
    .from("file_drive_edits")
    .select("id, synced_at, created_at");
  const total = (edits || []).length;
  const now = Date.now();
  const stale30 = (edits || []).filter((e: any) => {
    const last = e.synced_at ? new Date(e.synced_at).getTime() : new Date(e.created_at).getTime();
    return now - last > 30 * 86400_000;
  }).length;
  const stale90 = (edits || []).filter((e: any) => {
    const last = e.synced_at ? new Date(e.synced_at).getTime() : new Date(e.created_at).getTime();
    return now - last > 90 * 86400_000;
  }).length;

  // 5) file_versions 통계
  const { data: versions } = await svc.from("file_versions").select("id, bytes");
  const versionCount = (versions || []).length;
  const versionBytes = (versions || []).reduce((s: number, v: any) => s + ((v.bytes as number) || 0), 0);

  return NextResponse.json({
    groups: groupRanking.slice(0, 50),
    projects: projectRanking.slice(0, 50),
    drive_edits: {
      total,
      stale_30d: stale30,
      stale_90d: stale90,
    },
    versions: {
      count: versionCount,
      bytes: versionBytes,
    },
  });
});
