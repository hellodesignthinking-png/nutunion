import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const AddSchema = z.object({
  kind: z.enum(["youtube", "article", "drive_doc", "pdf", "link", "raw_text", "meeting_note", "interview"]),
  title: z.string().min(1).max(200),
  url: z.string().url().optional().nullable(),
  content_text: z.string().max(50000).optional().nullable(),
  excerpt: z.string().max(400).optional().nullable(),
  tags: z.array(z.string()).max(10).optional(),
  author_name: z.string().max(100).optional().nullable(),
});

function ytThumb(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/);
  return m ? `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` : null;
}

/** GET — 프로젝트의 모든 source 리스트 */
export const GET = withRouteLog("venture.projectId.sources.get", async (_req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) => {
  const { projectId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("venture_sources")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sources: data ?? [] });
});

/** POST — 새 source 추가 */
export const POST = withRouteLog("venture.projectId.sources.post", async (req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) => {
  const { projectId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await req.json().catch(() => ({}));
  const parsed = AddSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 입력", detail: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;

  // 멤버십 확인
  const { data: pm } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isAdminStaff = profile?.role === "admin" || profile?.role === "staff";
  if (!pm && !isAdminStaff) {
    return NextResponse.json({ error: "프로젝트 멤버만 소스 추가 가능" }, { status: 403 });
  }

  const thumbnail = body.kind === "youtube" ? ytThumb(body.url) : null;

  const { data, error } = await supabase
    .from("venture_sources")
    .insert({
      project_id: projectId,
      added_by: user.id,
      kind: body.kind,
      title: body.title,
      url: body.url ?? null,
      content_text: body.content_text ?? null,
      excerpt: body.excerpt ?? null,
      tags: body.tags ?? [],
      author_name: body.author_name ?? null,
      thumbnail_url: thumbnail,
      summary_status: "pending",
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // AI 요약은 비동기 트리거 (fire-and-forget, 실패해도 insert 는 성공)
  // 클라이언트는 이후 별도로 summary 생성 요청 가능
  return NextResponse.json({ source: data });
});

/** DELETE — ?id=xxx */
export const DELETE = withRouteLog("venture.projectId.sources.delete", async (req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) => {
  const { projectId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const sourceId = url.searchParams.get("id");
  if (!sourceId) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  const { error } = await supabase
    .from("venture_sources")
    .delete()
    .eq("id", sourceId)
    .eq("project_id", projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
});
