import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

type Source = "events" | "meetings" | "milestones";

async function authAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized", status: 401 as const };
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (prof?.role !== "admin") return { error: "forbidden", status: 403 as const };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!serviceKey) return { error: "service_role_not_configured", status: 501 as const };
  const admin = createAdminClient(url, serviceKey, { auth: { persistSession: false } });
  return { admin, userId: user.id };
}

const SOURCE_CONFIG: Record<Source, { slug: string; target_type: "nut" | "bolt"; legacy_table: string; idField: string }> = {
  events:     { slug: "calendar",    target_type: "nut",  legacy_table: "events",             idField: "legacy_id" },
  meetings:   { slug: "board",       target_type: "nut",  legacy_table: "meetings",           idField: "legacy_id" },
  milestones: { slug: "milestone",   target_type: "bolt", legacy_table: "project_milestones", idField: "legacy_id" },
};

async function getStatus(admin: any, source: Source) {
  const cfg = SOURCE_CONFIG[source];
  let total = 0;
  try {
    const { count } = await admin.from(cfg.legacy_table).select("id", { count: "exact", head: true });
    total = count || 0;
  } catch { total = 0; }

  // Migrated count: thread_data rows where data->>'legacy_table' = cfg.legacy_table
  let migrated = 0;
  try {
    const { count } = await admin
      .from("thread_data")
      .select("id", { count: "exact", head: true })
      .eq("data->>legacy_table", cfg.legacy_table);
    migrated = count || 0;
  } catch { migrated = 0; }

  return { total, migrated, pending: Math.max(0, total - migrated) };
}

async function findOrCreateInstallation(admin: any, slug: string, target_type: "nut" | "bolt", target_id: string, installer_id: string | null) {
  // Lookup thread
  const { data: thread } = await admin.from("threads").select("id").eq("slug", slug).maybeSingle();
  if (!thread) throw new Error(`thread_not_found: ${slug}`);

  // Find existing
  const { data: existing } = await admin
    .from("thread_installations")
    .select("id")
    .eq("thread_id", thread.id)
    .eq("target_type", target_type)
    .eq("target_id", target_id)
    .maybeSingle();
  if (existing) return existing.id as string;

  if (!installer_id) return null; // skip — no eligible installer

  // Create installation
  const { data: last } = await admin
    .from("thread_installations")
    .select("position")
    .eq("target_type", target_type)
    .eq("target_id", target_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPos = (last?.position ?? -1) + 1;

  const { data: inserted, error } = await admin
    .from("thread_installations")
    .insert({
      thread_id: thread.id,
      target_type,
      target_id,
      position: nextPos,
      config: {},
      is_enabled: true,
      installed_by: installer_id,
    })
    .select("id")
    .single();
  if (error) throw new Error(`installation_create_failed: ${error.message}`);
  return inserted.id as string;
}

async function migrate(admin: any, source: Source, batchSize: number) {
  const cfg = SOURCE_CONFIG[source];

  // Get already-migrated legacy ids for this source
  const { data: already } = await admin
    .from("thread_data")
    .select("data")
    .eq("data->>legacy_table", cfg.legacy_table)
    .limit(10000);
  const migratedIds = new Set<string>((already || []).map((r: any) => r.data?.legacy_id).filter(Boolean));

  // Fetch legacy rows
  const { data: rows, error: legErr } = await admin.from(cfg.legacy_table).select("*").limit(500);
  if (legErr) throw new Error(`legacy_query_failed: ${legErr.message}`);
  if (!rows || rows.length === 0) return { processed: 0, inserted: 0, skipped: 0 };

  const targets = rows.filter((r: any) => !migratedIds.has(r.id)).slice(0, batchSize);
  let inserted = 0;
  let skipped = 0;

  // Group leads/hosts cache for installer fallback
  const groupHostCache = new Map<string, string>();
  const projectLeadCache = new Map<string, string>();

  for (const r of targets) {
    let target_id: string | null = null;
    let installer: string | null = null;
    let mappedData: any = null;

    if (source === "events") {
      target_id = r.group_id;
      if (!target_id) { skipped++; continue; }
      if (!groupHostCache.has(target_id)) {
        const { data: g } = await admin.from("groups").select("host_id").eq("id", target_id).maybeSingle();
        if (g?.host_id) groupHostCache.set(target_id, g.host_id);
      }
      installer = groupHostCache.get(target_id) || null;
      mappedData = {
        title: r.title,
        description: r.description || "",
        start_at: r.start_at,
        end_at: r.end_at,
        location: r.location || "",
        is_recurring: !!r.is_recurring,
        legacy_id: r.id,
        legacy_table: cfg.legacy_table,
      };
    } else if (source === "meetings") {
      // meetings can be group or project; use group for board (nut)
      target_id = r.group_id;
      if (!target_id) { skipped++; continue; }
      if (!groupHostCache.has(target_id)) {
        const { data: g } = await admin.from("groups").select("host_id").eq("id", target_id).maybeSingle();
        if (g?.host_id) groupHostCache.set(target_id, g.host_id);
      }
      installer = groupHostCache.get(target_id) || null;
      const summaryParts = [r.description, r.summary, r.next_topic].filter(Boolean);
      mappedData = {
        title: `회의: ${r.title}`,
        body: summaryParts.join("\n\n") || `(예정: ${r.scheduled_at})`,
        pinned: false,
        legacy_id: r.id,
        legacy_table: cfg.legacy_table,
      };
    } else if (source === "milestones") {
      target_id = r.project_id;
      if (!target_id) { skipped++; continue; }
      if (!projectLeadCache.has(target_id)) {
        const { data: pm } = await admin
          .from("project_members")
          .select("user_id")
          .eq("project_id", target_id)
          .eq("role", "lead")
          .limit(1)
          .maybeSingle();
        if (pm?.user_id) projectLeadCache.set(target_id, pm.user_id);
      }
      installer = projectLeadCache.get(target_id) || null;
      mappedData = {
        title: r.title,
        description: r.description || "",
        sort_order: r.sort_order ?? 0,
        target_date: r.due_date,
        status: r.status,
        completed_at: r.status === "completed" ? r.created_at : null,
        legacy_id: r.id,
        legacy_table: cfg.legacy_table,
      };
    }

    if (!mappedData || !target_id) { skipped++; continue; }

    let installation_id: string | null;
    try {
      installation_id = await findOrCreateInstallation(admin, cfg.slug, cfg.target_type, target_id, installer);
    } catch {
      skipped++; continue;
    }
    if (!installation_id) { skipped++; continue; }

    const { error: insErr } = await admin.from("thread_data").insert({
      installation_id,
      data: mappedData,
      created_by: installer,
      created_at: r.created_at || new Date().toISOString(),
    });
    if (insErr) { skipped++; continue; }
    inserted++;
  }

  return { processed: targets.length, inserted, skipped };
}

export async function GET(_req: NextRequest) {
  const auth = await authAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const events = await getStatus(auth.admin, "events");
    const meetings = await getStatus(auth.admin, "meetings");
    const milestones = await getStatus(auth.admin, "milestones");
    return NextResponse.json({ events, meetings, milestones });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await req.json().catch(() => null);
  const source = body?.source as Source | undefined;
  const batch = Math.min(Math.max(Number(body?.batch || 50), 1), 200);
  if (!source || !SOURCE_CONFIG[source]) return NextResponse.json({ error: "invalid_source" }, { status: 400 });
  try {
    const result = await migrate(auth.admin, source, batch);
    return NextResponse.json({ ok: true, source, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
