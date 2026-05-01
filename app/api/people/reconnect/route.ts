import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/people/reconnect — 다시 만나면 좋을 인연 top 3 */
export const GET = withRouteLog("people.reconnect", async (_req: NextRequest) => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("people")
    .select("id, display_name, role_hint, company, relationship, importance, last_contact_at, phone, email, kakao_id, avatar_url")
    .eq("owner_id", auth.user.id)
    .gte("importance", 3)
    .or(`last_contact_at.lt.${ninetyDaysAgo},last_contact_at.is.null`)
    .order("importance", { ascending: false })
    .order("last_contact_at", { ascending: true, nullsFirst: true })
    .limit(3);

  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ rows: [], migration_needed: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rows: data || [] });
});
