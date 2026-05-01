import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/mobile-releases — 릴리스 원장에 기록
 *   Body: { platform, channel, version, buildNumber?, easBuildId?, easSubmitId?, storeUrl?, changelog?, status? }
 *
 * GET /api/admin/mobile-releases?channel=preview — 채널별 최근 릴리스 목록
 */
export const POST = withRouteLog("admin.mobile-releases.post", async (req: Request) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json();
  const { platform, channel, version, buildNumber, easBuildId, easSubmitId, storeUrl, changelog, status } = body;
  if (!platform || !channel || !version) {
    return NextResponse.json({ error: "platform, channel, version required" }, { status: 400 });
  }

  const { data, error } = await supabase.from("mobile_releases").insert({
    platform,
    channel,
    version,
    build_number: buildNumber || null,
    eas_build_id: easBuildId || null,
    eas_submit_id: easSubmitId || null,
    store_url: storeUrl || null,
    changelog: changelog || null,
    released_by: user.id,
    status: status || "built",
  }).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ release: data });
});

export const GET = withRouteLog("admin.mobile-releases.get", async (req: Request) => {
  const url = new URL(req.url);
  const channel = url.searchParams.get("channel");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let q = supabase.from("mobile_releases")
    .select("id, platform, channel, version, build_number, eas_build_id, store_url, changelog, status, released_at")
    .order("released_at", { ascending: false })
    .limit(50);
  if (channel) q = q.eq("channel", channel);

  const { data } = await q;
  return NextResponse.json({ releases: data || [] });
});
