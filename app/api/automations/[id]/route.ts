/**
 * PATCH  /api/automations/:id  — toggle or update scope
 * DELETE /api/automations/:id
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) || {};
  const patch: any = { updated_at: new Date().toISOString() };
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active;
  if (typeof body.require_approval === "boolean") patch.require_approval = body.require_approval;
  if (body.scope && typeof body.scope === "object") patch.scope = body.scope;
  if (typeof body.name === "string") patch.name = body.name;
  if (body.conditions && typeof body.conditions === "object") patch.conditions = body.conditions;
  if (Array.isArray(body.actions)) patch.actions = body.actions;

  const { data, error } = await supabase
    .from("automation_rules")
    .update(patch)
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data });
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("automation_rules")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
