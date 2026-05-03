import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

interface RouteContext { params: Promise<{ id: string }>; }

const FIELD_TYPES = ["text", "number", "currency", "percent", "date", "select", "multi_select", "url", "user"] as const;

/**
 * GET   — 정의 + 현재 값 모두
 * POST  — 새 필드 정의 추가  body: { key, label, field_type, options?, position?, is_required? }
 * PATCH — 필드 값 일괄 업데이트  body: { values: [{ field_def_id, value_text?, value_number?, value_date?, value_json? }] }
 */
export const GET = withRouteLog("projects.fields.get", async (_req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const [{ data: defs }, { data: values }] = await Promise.all([
    supabase.from("project_field_defs").select("id, key, label, field_type, options, position, is_required, created_at").eq("project_id", id).order("position"),
    supabase.from("project_field_values").select("id, field_def_id, value_text, value_number, value_date, value_json, updated_at").eq("project_id", id),
  ]);
  return NextResponse.json({ defs: defs ?? [], values: values ?? [] });
});

export const POST = withRouteLog("projects.fields.post_def", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null) as {
    key?: string; label?: string;
    field_type?: typeof FIELD_TYPES[number];
    options?: Array<string | { value: string; label?: string }>;
    position?: number;
    is_required?: boolean;
  } | null;

  if (!body?.key || !body.label || !body.field_type || !FIELD_TYPES.includes(body.field_type)) {
    return NextResponse.json({ error: "invalid_def" }, { status: 400 });
  }
  // key 정규화 — 영문 소문자/숫자/언더스코어
  const key = body.key.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40);
  if (!key) return NextResponse.json({ error: "invalid_key" }, { status: 400 });

  const { data, error } = await supabase
    .from("project_field_defs")
    .insert({
      project_id: id,
      key,
      label: body.label.slice(0, 60),
      field_type: body.field_type,
      options: body.options ?? [],
      position: body.position ?? 0,
      is_required: !!body.is_required,
    })
    .select("id, key, label, field_type, options, position, is_required, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ def: data }, { status: 201 });
});

export const PATCH = withRouteLog("projects.fields.patch_values", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null) as {
    values?: Array<{
      field_def_id: string;
      value_text?: string | null;
      value_number?: number | null;
      value_date?: string | null;
      value_json?: unknown;
    }>;
  } | null;
  if (!body?.values || !Array.isArray(body.values)) {
    return NextResponse.json({ error: "values array required" }, { status: 400 });
  }

  const upserts = body.values.map((v) => ({
    project_id: id,
    field_def_id: v.field_def_id,
    value_text: v.value_text ?? null,
    value_number: v.value_number ?? null,
    value_date: v.value_date ?? null,
    value_json: v.value_json ?? null,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("project_field_values")
    .upsert(upserts, { onConflict: "project_id,field_def_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, updated: upserts.length });
});
