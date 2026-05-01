import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";

// POST /api/threads/builder/save
// Body: { thread_id?, builder_mode, name, description, icon, scope[], category,
//         fields[], views[], actions[], is_draft, ai_reasoning? }
//
// Creates or updates a custom Thread, then (if not draft) auto-creates a Carriage Bolt
// for development tracking and installs it back onto the Thread row.

const FIELD_TYPE_TO_JSON: Record<string, any> = {
  text: { type: "string" },
  longtext: { type: "string" },
  number: { type: "number" },
  currency: { type: "number" },
  date: { type: "string", format: "date" },
  datetime: { type: "string", format: "date-time" },
  checkbox: { type: "boolean" },
  select: { type: "string" },
  multiselect: { type: "array", items: { type: "string" } },
  tags: { type: "array", items: { type: "string" } },
  person: { type: "string" },
  url: { type: "string", format: "uri" },
  location: { type: "string" },
  file: { type: "string" },
};

function buildJsonSchema(fields: any[]): any {
  const properties: Record<string, any> = {};
  const required: string[] = [];
  for (const f of fields) {
    properties[f.key] = { ...(FIELD_TYPE_TO_JSON[f.type] || { type: "string" }), title: f.label };
    if (Array.isArray(f.options)) properties[f.key].enum = f.options;
    if (f.required) required.push(f.key);
  }
  return { type: "object", properties, required: required.length ? required : undefined };
}

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "");
  const rand = Math.random().toString(36).slice(2, 6);
  return `${base || "thread"}-${rand}`.slice(0, 60);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad_json" }, { status: 400 });

  const {
    thread_id,
    builder_mode = "no-code",
    name,
    description = "",
    icon = "📋",
    scope = ["bolt"],
    category = "custom",
    fields = [],
    views = [{ kind: "list" }],
    actions = [],
    is_draft = false,
    ai_reasoning = null,
    generated_component_source = null,
    ui_component: ui_component_override = null,
  } = body;

  if (!is_draft) {
    if (!name || typeof name !== "string") return NextResponse.json({ error: "name_required" }, { status: 400 });
    if (!Array.isArray(fields) || fields.length === 0) return NextResponse.json({ error: "fields_required" }, { status: 400 });
    if (!Array.isArray(views) || views.length === 0) return NextResponse.json({ error: "views_required" }, { status: 400 });
  }

  // Code-mode validation: require source and use special ui_component
  const isCodeMode = builder_mode === "code";
  if (isCodeMode && !generated_component_source) {
    return NextResponse.json({ error: "code_source_required" }, { status: 400 });
  }
  const ui_component = ui_component_override || (isCodeMode ? "__code__" : "__generic__");

  const schema = buildJsonSchema(fields);
  const builder_state = { name, description, icon, scope, category, fields, views, actions, ai_reasoning };

  // INSERT or UPDATE thread row
  let threadRow: any;
  if (thread_id) {
    const { data: existing } = await supabase.from("threads").select("created_by, slug").eq("id", thread_id).maybeSingle();
    if (!existing || existing.created_by !== user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const { data, error } = await supabase
      .from("threads")
      .update({
        name: name || "Untitled",
        description,
        icon,
        scope,
        category,
        schema,
        builder_mode,
        builder_state,
        is_draft,
        ui_component,
        generated_component_source: isCodeMode ? generated_component_source : null,
        // Code-mode threads stay private until admin approves
        is_public: isCodeMode ? false : !is_draft,
        updated_at: new Date().toISOString(),
      })
      .eq("id", thread_id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    threadRow = data;
  } else {
    const slug = slugify(name || "thread");
    const { data, error } = await supabase
      .from("threads")
      .insert({
        slug,
        name: name || "Untitled",
        description,
        icon,
        category,
        scope,
        schema,
        config_schema: null,
        ui_component,
        is_core: false,
        // Code-mode threads stay private until admin approves
        is_public: isCodeMode ? false : !is_draft,
        generated_component_source: isCodeMode ? generated_component_source : null,
        pricing: "free",
        price_krw: 0,
        created_by: user.id,
        builder_mode,
        builder_state,
        is_draft,
        version: "1.0.0",
      })
      .select("*")
      .single();
    if (error) {
      if (/relation .* does not exist/i.test(error.message) || error.code === "42P01") {
        return NextResponse.json({ error: "migration_115_or_122_missing" }, { status: 503 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    threadRow = data;
  }

  // Drafts stop here
  if (is_draft) {
    return NextResponse.json({ slug: threadRow.slug, thread_id: threadRow.id, project_id: null });
  }

  // Skip bolt creation if we're updating a thread that already has one
  if (threadRow.created_bolt_id) {
    return NextResponse.json({ slug: threadRow.slug, thread_id: threadRow.id, project_id: threadRow.created_bolt_id });
  }

  // Auto-create Carriage Bolt
  let projectId: string | null = null;
  try {
    const { data: project, error: pErr } = await supabase
      .from("projects")
      .insert({
        title: `Thread 개발: ${name}`,
        description: description || `'${name}' Thread 의 개발 진행을 추적하는 볼트.`,
        status: "active",
        category: "platform",  // closest existing category
        type: "carriage",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (pErr) throw pErr;
    projectId = project.id;

    // Add user as lead
    await supabase.from("project_members").insert({
      project_id: projectId,
      user_id: user.id,
      role: "lead",
    });

    // Carriage subtype row
    await supabase.from("project_carriage").insert({ project_id: projectId }).select().maybeSingle();

    // Auto-install useful Threads on the new bolt
    const { data: coreThreads } = await supabase
      .from("threads")
      .select("id, slug")
      .in("slug", ["milestone", "board", "ai-copilot"]);
    if (coreThreads && coreThreads.length > 0) {
      const inserts = coreThreads.map((t, i) => ({
        thread_id: t.id,
        target_type: "bolt",
        target_id: projectId,
        position: i,
        config: {},
        is_enabled: true,
        installed_by: user.id,
      }));
      await supabase.from("thread_installations").insert(inserts);
    }

    // Link the bolt back to the thread row
    await supabase.from("threads").update({ created_bolt_id: projectId }).eq("id", threadRow.id);
  } catch (e: any) {
    log.error(e, "threads.builder.save.failed");
    // Bolt creation is best-effort — Thread itself was saved successfully.
    console.error("[builder/save] carriage bolt create failed:", e?.message || e);
  }

  return NextResponse.json({
    slug: threadRow.slug,
    thread_id: threadRow.id,
    project_id: projectId,
  });
}
