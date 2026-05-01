import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

/**
 * 마인드맵 노드 위치 + 보기 모드 영속 — 다기기 동기화.
 *
 * GET   → { layout: { [id]: {x,y} }, viewMode: "radial"|"timeline" }
 * PUT   body: { layout?, viewMode? } — 부분 업데이트 (둘 다 옵션)
 */

interface DashboardSettings {
  mindmap_layout?: Record<string, { x: number; y: number }>;
  mindmap_view_mode?: "radial" | "timeline";
}

export const GET = withRouteLog("dashboard.mindmap-layout.get", async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("profiles")
    .select("dashboard_settings")
    .eq("id", user.id)
    .maybeSingle();

  const settings = ((data?.dashboard_settings ?? {}) as DashboardSettings);
  return NextResponse.json({
    layout: settings.mindmap_layout ?? {},
    viewMode: settings.mindmap_view_mode ?? "radial",
  });
});

export const PUT = withRouteLog("dashboard.mindmap-layout.put", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    layout?: Record<string, { x: number; y: number }>;
    viewMode?: "radial" | "timeline";
  } | null;
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  // 서버측 검증 — JSONB 폭주 방지: 노드 200개 제한, 좌표 범위 제한
  if (body.layout) {
    const ids = Object.keys(body.layout);
    if (ids.length > 200) return NextResponse.json({ error: "too_many_nodes" }, { status: 413 });
    for (const id of ids) {
      const p = body.layout[id];
      if (typeof p?.x !== "number" || typeof p?.y !== "number") {
        return NextResponse.json({ error: "invalid_position" }, { status: 400 });
      }
      if (Math.abs(p.x) > 50_000 || Math.abs(p.y) > 50_000) {
        return NextResponse.json({ error: "position_out_of_range" }, { status: 400 });
      }
    }
  }
  if (body.viewMode && body.viewMode !== "radial" && body.viewMode !== "timeline") {
    return NextResponse.json({ error: "invalid_view_mode" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("dashboard_settings")
    .eq("id", user.id)
    .maybeSingle();
  const current = ((existing?.dashboard_settings ?? {}) as DashboardSettings);

  const next: DashboardSettings = {
    ...current,
    ...(body.layout !== undefined ? { mindmap_layout: body.layout } : {}),
    ...(body.viewMode !== undefined ? { mindmap_view_mode: body.viewMode } : {}),
  };

  const { error } = await supabase
    .from("profiles")
    .update({ dashboard_settings: next })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
});
