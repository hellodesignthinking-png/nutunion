import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { registry } from "@/lib/threads/bootstrap";

// POST /api/threads/sync-registry
//   Admin-only. UPSERTs every Thread definition in the runtime registry into the `threads` table.
export async function POST(_req: NextRequest) {
  // Auth: admin only
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (prof?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!serviceKey) {
    return NextResponse.json({ error: "service_role_not_configured" }, { status: 501 });
  }
  const admin = createAdminClient(url, serviceKey, { auth: { persistSession: false } });

  const defs = registry.all();
  const rows = defs.map((d) => ({
    slug: d.slug,
    name: d.name,
    description: d.description,
    icon: d.icon,
    category: d.category,
    scope: d.scope,
    schema: d.schema ?? {},
    config_schema: d.configSchema ?? null,
    ui_component: d.slug,
    is_core: !!d.isCore,
    is_public: true,
    version: d.version || "1.0.0",
  }));

  const { data, error } = await admin
    .from("threads")
    .upsert(rows, { onConflict: "slug" })
    .select("slug, id");

  if (error) {
    if (/relation .* does not exist/i.test(error.message) || (error as any).code === "42P01") {
      return NextResponse.json({ error: "migration_115_missing" }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ synced: data?.length ?? 0, slugs: (data || []).map((r: any) => r.slug) });
}
