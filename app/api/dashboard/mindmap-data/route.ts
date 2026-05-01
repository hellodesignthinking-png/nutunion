import { NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { fetchMindMapData } from "@/lib/dashboard/mindmap-data";

/**
 * GET /api/dashboard/mindmap-data
 *
 * 모바일 앱(React Native)이 마인드맵 미러를 그리기 위해 호출.
 * 웹은 server component 에서 직접 fetchMindMapData 를 부르므로 별도 라우트 불필요.
 *
 * 인증: Supabase access_token (모바일은 Authorization Bearer 헤더로 전달).
 */
export const GET = withRouteLog("dashboard.mindmap-data", async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const data = await fetchMindMapData(supabase, user.id).catch(() => ({
    nuts: [], bolts: [], schedule: [], issues: [], washers: [], topics: [], files: [],
  }));

  return NextResponse.json(data);
});
