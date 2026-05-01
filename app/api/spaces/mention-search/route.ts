import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/spaces/mention-search?q=...&owner_type=nut|bolt&owner_id=...
 *
 * 너트/볼트 안에서 mention 자동완성 — 사용자가 가진 entity 들 중 q 매칭.
 *
 * 반환:
 *   { results: Array<{
 *       kind: "user" | "nut" | "bolt" | "page" | "topic" | "schedule" | "issue" | "file",
 *       id: string,
 *       label: string,
 *       sub?: string,
 *       href?: string,
 *     }> }
 *
 * Notion 의 mention 은 페이지/사용자만. 우리는 마인드맵의 모든 도메인 entity.
 */
const MAX_RESULTS_PER_KIND = 5;

export const GET = withRouteLog("spaces.mention-search", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const ownerType = searchParams.get("owner_type");
  const ownerId = searchParams.get("owner_id");
  if (q.length === 0) return NextResponse.json({ results: [] });

  const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
  const results: Array<Record<string, unknown>> = [];

  // 1. 자기와 닿는 사용자 (group_members + project_members 의 동료)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nickname, avatar_url")
    .ilike("nickname", like)
    .limit(MAX_RESULTS_PER_KIND);
  for (const p of (profiles ?? []) as Array<{ id: string; nickname: string; avatar_url: string | null }>) {
    results.push({
      kind: "user",
      id: p.id,
      label: p.nickname,
      sub: "동료",
      href: `/people/${p.id}`,
      avatar: p.avatar_url,
    });
  }

  // 2. 너트 (사용자가 멤버인 너트만 — RLS)
  const { data: nuts } = await supabase
    .from("groups")
    .select("id, name")
    .ilike("name", like)
    .limit(MAX_RESULTS_PER_KIND);
  for (const n of (nuts ?? []) as Array<{ id: string; name: string }>) {
    results.push({
      kind: "nut",
      id: n.id,
      label: n.name,
      sub: "너트",
      href: `/groups/${n.id}`,
    });
  }

  // 3. 볼트
  const { data: bolts } = await supabase
    .from("projects")
    .select("id, title, status")
    .ilike("title", like)
    .limit(MAX_RESULTS_PER_KIND);
  for (const b of (bolts ?? []) as Array<{ id: string; title: string; status: string }>) {
    results.push({
      kind: "bolt",
      id: b.id,
      label: b.title,
      sub: `볼트 · ${b.status}`,
      href: `/projects/${b.id}`,
    });
  }

  // 4. 같은 owner 의 다른 페이지
  if (ownerType && ownerId && (ownerType === "nut" || ownerType === "bolt")) {
    const { data: pages } = await supabase
      .from("space_pages")
      .select("id, title, icon")
      .eq("owner_type", ownerType)
      .eq("owner_id", ownerId)
      .ilike("title", like)
      .limit(MAX_RESULTS_PER_KIND);
    for (const p of (pages ?? []) as Array<{ id: string; title: string; icon: string | null }>) {
      results.push({
        kind: "page",
        id: p.id,
        label: p.title,
        sub: "페이지",
        icon: p.icon || "📄",
      });
    }
  }

  // 5. wiki 탭
  const { data: topics } = await supabase
    .from("wiki_topics")
    .select("id, name, group_id")
    .ilike("name", like)
    .limit(MAX_RESULTS_PER_KIND);
  for (const t of (topics ?? []) as Array<{ id: string; name: string; group_id: string }>) {
    results.push({
      kind: "topic",
      id: t.id,
      label: t.name,
      sub: "위키 탭",
      href: `/groups/${t.group_id}/wiki/topics/${t.id}`,
    });
  }

  return NextResponse.json({ results: results.slice(0, 30) });
});
