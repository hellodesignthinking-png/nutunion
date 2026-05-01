import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

// GET /api/threads — list public threads
//   ?scope=nut|bolt  &category=<cat>
export const GET = withRouteLog("threads", async (req: NextRequest) => {
  const supabase = await createClient();
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope");
  const category = url.searchParams.get("category");

  let q = supabase
    .from("threads")
    .select("id, slug, name, description, icon, category, scope, is_core, is_public, pricing, price_krw, install_count, avg_rating, version, created_at")
    .eq("is_public", true)
    .order("install_count", { ascending: false });

  if (category) q = q.eq("category", category);

  const { data, error } = await q;
  if (error) {
    // migration 115 may be missing → graceful fallback
    if (/relation .* does not exist/i.test(error.message) || error.code === "42P01") {
      return NextResponse.json({ threads: [], warning: "migration_115_missing" });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const filtered = scope
    ? (data || []).filter((t: any) => Array.isArray(t.scope) && t.scope.includes(scope))
    : data || [];

  return NextResponse.json({ threads: filtered }, {
    headers: {
      // Public list — safe to share across users at the CDN edge.
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
});
