import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/projects/[id]/archive-to-wiki
 * 마감된 볼트의 closure_summary 를 wiki_pages 에 승격.
 * 069 마이그레이션의 트리거 백업 — 누락된 환경에서도 수동 호출로 동작.
 */
export const POST = withRouteLog("projects.id.archive-to-wiki", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, status, closure_summary, closure_highlights, closed_by, created_by, category")
    .eq("id", id)
    .single();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (project.status !== "completed" || !project.closure_summary) {
    return NextResponse.json({ error: "아직 마감되지 않았거나 회고록이 비어있습니다" }, { status: 400 });
  }

  // 권한: admin / creator / closed_by 만
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const canArchive = profile?.role === "admin" || project.created_by === user.id || project.closed_by === user.id;
  if (!canArchive) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const slug = `bolt-${project.id}`;

  // 기존 승격본 있는지
  const { data: existing } = await supabase.from("wiki_pages").select("id").eq("slug", slug).maybeSingle();
  if (existing) {
    return NextResponse.json({ already_archived: true, slug, url: `/wiki/${slug}` });
  }

  const content =
    `# ${project.title}\n\n` +
    `> _Tap 아카이브 — 마감된 볼트의 회고록·산출물입니다._\n\n` +
    `## 회고\n${project.closure_summary}\n\n` +
    (project.closure_highlights ? `## 하이라이트\n\`\`\`json\n${JSON.stringify(project.closure_highlights, null, 2)}\n\`\`\`\n\n` : "") +
    `---\n볼트 원본: [/projects/${project.id}](/projects/${project.id})`;

  // wiki_pages 에 category 컬럼 없음 — slug 만 사용.
  // slug 컬럼 누락 환경 대비: 1차 insert 실패 시 slug 없이 재시도.
  const payload: any = {
    slug,
    title: `[Tap] ${project.title}`,
    content,
    created_by: user.id,
  };
  let { error } = await supabase.from("wiki_pages").insert(payload);
  if (error && /slug/.test(error.message || "")) {
    delete payload.slug;
    ({ error } = await supabase.from("wiki_pages").insert(payload));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, slug, url: `/wiki/${slug}` });
});
