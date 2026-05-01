import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

/**
 * POST /api/projects/[id]/integrations
 * 볼트별 외부 리소스 자동 생성.
 * Body: { provider: 'slack'|'notion'|'github', action: 'create'|'link', name?, parentId? }
 *
 * GET /api/projects/[id]/integrations — 연결된 리소스 목록
 */

async function getAccessToken(userId: string, provider: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const db = createServiceClient(url, key, { auth: { persistSession: false } });
  const { data } = await db
    .from("external_integrations")
    .select("access_token")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  return data?.access_token ?? null;
}

export const GET = withRouteLog("projects.id.integrations.get", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id: projectId } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("bolt_integrations")
    .select("id, provider, resource_type, resource_id, resource_name, resource_url, metadata, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return NextResponse.json({ integrations: data || [] });
});

export const POST = withRouteLog("projects.id.integrations.post", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id: projectId } = await params;
  const body = await req.json();
  const { provider, action, name, parentId } = body as { provider: string; action: string; name?: string; parentId?: string };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 멤버/소유자 체크
  const [{ data: project }, { data: membership }] = await Promise.all([
    supabase.from("projects").select("title, created_by").eq("id", projectId).maybeSingle(),
    supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const isOwner = project.created_by === user.id || !!membership;
  if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const token = await getAccessToken(user.id, provider);
  if (!token) return NextResponse.json({ error: `${provider} 연결이 필요합니다`, connect: `/api/integrations/${provider}/connect` }, { status: 400 });

  const resourceName = (name || project.title).slice(0, 80);

  try {
    let resource: { id: string; name: string; url?: string; type: string; metadata?: any } | null = null;

    if (provider === "slack" && action === "create") {
      const channelName = resourceName.toLowerCase().replace(/[^a-z0-9가-힣]/g, "-").replace(/-+/g, "-").slice(0, 80);
      const res = await fetch("https://slack.com/api/conversations.create", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ name: `bolt-${channelName}`, is_private: false }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Slack channel create failed");
      resource = {
        id: data.channel.id,
        name: data.channel.name,
        url: `https://slack.com/app_redirect?channel=${data.channel.id}`,
        type: "channel",
        metadata: data.channel,
      };
    } else if (provider === "notion" && action === "create") {
      // Notion: 페이지 생성 (부모 페이지 필요)
      if (!parentId) throw new Error("Notion parent page ID 가 필요합니다");
      const res = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({
          parent: { page_id: parentId },
          properties: { title: { title: [{ text: { content: `[Bolt] ${resourceName}` } }] } },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Notion page create failed");
      resource = { id: data.id, name: `[Bolt] ${resourceName}`, url: data.url, type: "page", metadata: data };
    } else if (provider === "github" && action === "create") {
      const repoName = resourceName.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 100);
      const res = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: `bolt-${repoName}`, description: `nutunion 볼트: ${project.title}`, private: true, auto_init: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "GitHub repo create failed");
      resource = { id: String(data.id), name: data.full_name, url: data.html_url, type: "repo", metadata: { full_name: data.full_name, default_branch: data.default_branch } };
    } else {
      return NextResponse.json({ error: "Unsupported provider/action combination" }, { status: 400 });
    }

    // bolt_integrations 저장
    const { data: saved, error } = await supabase.from("bolt_integrations").insert({
      project_id: projectId,
      provider,
      resource_type: resource!.type,
      resource_id: resource!.id,
      resource_name: resource!.name,
      resource_url: resource!.url,
      metadata: resource!.metadata,
      created_by: user.id,
    }).select("*").single();

    if (error) return NextResponse.json({ error: error.message, resource }, { status: 500 });
    return NextResponse.json({ success: true, integration: saved });
  } catch (err: any) {
    log.error(err, "projects.id.integrations.failed");
    return NextResponse.json({ error: err.message || "Create failed" }, { status: 500 });
  }
});
