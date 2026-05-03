import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { withRouteLog } from "@/lib/observability/route-handler";

interface RouteContext { params: Promise<{ token: string }>; }

/**
 * Public 공유 뷰어 API — 로그인 불필요. RLS 우회 위해 service role 사용.
 *
 * GET /api/share/projects/{token}?password=...&email=...
 *   • token 으로 share_link 조회 → 만료/취소/비번/이메일 검증
 *   • 통과 시 scope 에 포함된 데이터만 반환 (overview/milestones/files/meetings/finance/decisions/risks)
 *   • view_count 증가 + last_viewed_at 갱신 + access log 기록
 *
 * POST /api/share/projects/{token}/log
 *   action: download/comment/upload — log 만 기록
 */

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

function hashPwd(s: string) { return createHash("sha256").update(s, "utf-8").digest("hex"); }

export const GET = withRouteLog("share.projects.public.get", async (req: NextRequest, ctx: RouteContext) => {
  const { token } = await ctx.params;
  const url = req.nextUrl;
  const password = url.searchParams.get("password") || "";
  const email = url.searchParams.get("email") || "";

  const db = svc();
  const { data: link } = await db
    .from("project_share_links")
    .select("id, project_id, permission, label, expires_at, revoked_at, password_hash, require_email, allow_download, show_overview, show_milestones, show_files, show_meetings, show_finance, show_decisions, show_risks")
    .eq("token", token)
    .maybeSingle();

  if (!link) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (link.revoked_at) return NextResponse.json({ error: "revoked" }, { status: 410 });
  if (link.expires_at && new Date(link.expires_at as string) < new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }
  if (link.password_hash && hashPwd(password) !== link.password_hash) {
    return NextResponse.json({ error: "password_required" }, { status: 401 });
  }
  if (link.require_email && !email) {
    return NextResponse.json({ error: "email_required" }, { status: 401 });
  }

  // 프로젝트 + scope 에 포함된 영역만 fetch
  const projectId = link.project_id as string;
  const empty = Promise.resolve({ data: [] as unknown[] });
  const [projRes, msRes, filesRes, meetingsRes, decRes, riskRes] = await Promise.all([
    db.from("projects").select("id, title, description, status, total_budget, deadline, created_at, type").eq("id", projectId).maybeSingle(),
    link.show_milestones
      ? db.from("project_milestones").select("id, title, description, status, due_date, sort_order").eq("project_id", projectId).order("sort_order")
      : empty,
    link.show_files
      ? db.from("file_attachments").select("id, filename, file_size, mime_type, target_id, created_at").eq("target_type", "project").eq("target_id", projectId).order("created_at", { ascending: false }).limit(60)
      : empty,
    // meetings 는 group 기준이라 외부 공유에서는 일단 빈 — 미래 확장 시 project_meetings 통합
    empty,
    link.show_decisions
      ? db.from("project_decisions").select("id, title, rationale, decided_at, status").eq("project_id", projectId).order("decided_at", { ascending: false }).limit(50)
      : empty,
    link.show_risks
      ? db.from("project_risks").select("id, title, description, severity, status, due_at").eq("project_id", projectId).neq("status", "resolved").order("severity", { ascending: false }).limit(50)
      : empty,
  ]);
  const project = (projRes as { data: Record<string, unknown> | null }).data;
  if (!project) return NextResponse.json({ error: "project_not_found" }, { status: 404 });

  // access log + counter (best-effort, fire and forget)
  void db.from("project_share_links").update({
    last_viewed_at: new Date().toISOString(),
    view_count: (link as unknown as { view_count?: number }).view_count != null ? undefined : 1, // PostgREST 는 expression 갱신 못 함 → RPC 추후
  }).eq("id", link.id);
  void db.rpc("increment_share_view_count", { link_id: link.id }).then(() => undefined, () => undefined);
  void db.from("project_share_access_logs").insert({
    share_link_id: link.id,
    visitor_email: email || null,
    visitor_ip: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null,
    user_agent: req.headers.get("user-agent")?.slice(0, 200) || null,
    action: "view",
  });

  return NextResponse.json({
    permission: link.permission,
    label: link.label,
    allow_download: link.allow_download,
    project: link.show_overview ? project : { id: project.id, title: project.title },
    milestones: (msRes as { data: unknown[] }).data ?? [],
    files: (filesRes as { data: unknown[] }).data ?? [],
    meetings: (meetingsRes as { data: unknown[] }).data ?? [],
    decisions: (decRes as { data: unknown[] }).data ?? [],
    risks: (riskRes as { data: unknown[] }).data ?? [],
  });
});
