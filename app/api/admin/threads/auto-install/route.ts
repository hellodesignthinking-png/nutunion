import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// POST /api/admin/threads/auto-install
//   Installs Core Threads on every existing nut/bolt that doesn't have them yet.
//   Admin only. Idempotent.
//
// GET /api/admin/threads/auto-install
//   Preview: returns counts that *would* be created.

const NUT_CORE = ["board", "members", "announcement", "ai-copilot"];
const BOLT_CORE = ["milestone", "ai-copilot"];

async function gatherPlan(admin: any) {
  // Lookup core thread ids
  const allCore = Array.from(new Set([...NUT_CORE, ...BOLT_CORE]));
  const { data: threads, error: tErr } = await admin
    .from("threads")
    .select("id, slug, scope")
    .in("slug", allCore);
  if (tErr) throw new Error(`threads_lookup_failed: ${tErr.message}`);
  const bySlug = new Map<string, { id: string; slug: string; scope: string[] }>();
  (threads || []).forEach((t: any) => bySlug.set(t.slug, t));

  const missingSlugs = allCore.filter((s) => !bySlug.has(s));
  if (missingSlugs.length > 0) {
    throw new Error(`threads_not_synced: ${missingSlugs.join(",")} — run Sync Registry → DB first`);
  }

  // Groups
  const { data: groups, error: gErr } = await admin
    .from("groups")
    .select("id, host_id");
  if (gErr) throw new Error(`groups_query_failed: ${gErr.message}`);

  // Projects
  const { data: projects, error: pErr } = await admin
    .from("projects")
    .select("id");
  if (pErr) throw new Error(`projects_query_failed: ${pErr.message}`);

  // Existing installations
  const { data: existing, error: eErr } = await admin
    .from("thread_installations")
    .select("thread_id, target_type, target_id");
  if (eErr) throw new Error(`installations_query_failed: ${eErr.message}`);

  const existingKey = new Set<string>();
  (existing || []).forEach((x: any) => existingKey.add(`${x.target_type}:${x.target_id}:${x.thread_id}`));

  // Project leads (for installed_by fallback)
  const { data: leads } = await admin
    .from("project_members")
    .select("project_id, user_id, role")
    .eq("role", "lead");
  const leadByProject = new Map<string, string>();
  (leads || []).forEach((l: any) => { if (!leadByProject.has(l.project_id)) leadByProject.set(l.project_id, l.user_id); });

  const inserts: any[] = [];

  for (const g of (groups || []) as Array<{ id: string; host_id: string }>) {
    let pos = 0;
    for (const slug of NUT_CORE) {
      const t = bySlug.get(slug)!;
      const key = `nut:${g.id}:${t.id}`;
      if (existingKey.has(key)) continue;
      inserts.push({
        thread_id: t.id,
        target_type: "nut",
        target_id: g.id,
        position: pos++,
        config: {},
        is_enabled: true,
        installed_by: g.host_id,
      });
    }
  }

  for (const p of (projects || []) as Array<{ id: string }>) {
    let pos = 0;
    const installer = leadByProject.get(p.id);
    if (!installer) continue; // no lead — skip this project (RLS-safe)
    for (const slug of BOLT_CORE) {
      const t = bySlug.get(slug)!;
      const key = `bolt:${p.id}:${t.id}`;
      if (existingKey.has(key)) continue;
      inserts.push({
        thread_id: t.id,
        target_type: "bolt",
        target_id: p.id,
        position: pos++,
        config: {},
        is_enabled: true,
        installed_by: installer,
      });
    }
  }

  return {
    groups_total: groups?.length ?? 0,
    projects_total: projects?.length ?? 0,
    inserts_planned: inserts.length,
    inserts,
  };
}

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
  return { admin };
}

export async function GET(_req: NextRequest) {
  const auth = await authAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const plan = await gatherPlan(auth.admin);
    return NextResponse.json({
      preview: true,
      groups_total: plan.groups_total,
      projects_total: plan.projects_total,
      inserts_planned: plan.inserts_planned,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(_req: NextRequest) {
  const auth = await authAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const plan = await gatherPlan(auth.admin);
    if (plan.inserts.length === 0) {
      return NextResponse.json({
        ok: true, inserts: 0,
        groups_processed: plan.groups_total,
        projects_processed: plan.projects_total,
        note: "nothing_to_install",
      });
    }
    // Insert in chunks (PostgREST default ok for ~1000)
    let inserted = 0;
    const CHUNK = 200;
    for (let i = 0; i < plan.inserts.length; i += CHUNK) {
      const chunk = plan.inserts.slice(i, i + CHUNK);
      const { error: insErr, data } = await auth.admin
        .from("thread_installations")
        .insert(chunk)
        .select("id");
      if (insErr) throw new Error(`insert_failed: ${insErr.message}`);
      inserted += (data as any[] | null)?.length || chunk.length;
    }
    // Refresh install counts
    const slugCounts = new Map<string, number>();
    plan.inserts.forEach((r: any) => slugCounts.set(r.thread_id, (slugCounts.get(r.thread_id) || 0) + 1));
    for (const [thread_id, add] of slugCounts) {
      const { data: cur } = await auth.admin.from("threads").select("install_count").eq("id", thread_id).maybeSingle();
      if (cur) {
        await auth.admin.from("threads").update({ install_count: (cur.install_count ?? 0) + add }).eq("id", thread_id);
      }
    }
    return NextResponse.json({
      ok: true,
      groups_processed: plan.groups_total,
      projects_processed: plan.projects_total,
      inserts: inserted,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
