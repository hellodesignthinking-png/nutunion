import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

// GET /api/threads/installations?target_type=&target_id=
export const GET = withRouteLog("threads.installations", async (req: NextRequest) => {
  const supabase = await createClient();
  const url = new URL(req.url);
  const target_type = url.searchParams.get("target_type");
  const target_id = url.searchParams.get("target_id");

  if (!target_type || !target_id) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }
  if (target_type !== "nut" && target_type !== "bolt") {
    return NextResponse.json({ error: "invalid_target_type" }, { status: 400 });
  }
  // UUID format validation — prevents Postgres "invalid input syntax for uuid" 500s
  if (!/^[0-9a-fA-F-]{36}$/.test(target_id)) {
    return NextResponse.json({ error: "invalid_target_id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("thread_installations")
    .select(`
      id, thread_id, target_type, target_id, position, config, is_enabled, installed_by, installed_at,
      thread:threads ( id, slug, name, description, icon, category, scope, schema, config_schema, is_core, version, ui_component, builder_state, builder_mode )
    `)
    .eq("target_type", target_type)
    .eq("target_id", target_id)
    .order("position", { ascending: true });

  if (error) {
    if (/relation .* does not exist/i.test(error.message) || error.code === "42P01") {
      return NextResponse.json({ installations: [], warning: "migration_115_missing" });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ installations: data || [] });
});
