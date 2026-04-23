import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET /api/personal/notes?archived=0|1 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const archived = new URL(req.url).searchParams.get("archived") === "1";

  const { data, error } = await supabase
    .from("personal_notes")
    .select("*")
    .eq("user_id", auth.user.id)
    .eq("is_archived", archived)
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) {
    if (/relation.*personal_notes.*does not exist/i.test(error.message)) {
      return NextResponse.json({ rows: [], migration_needed: 112 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rows: data });
}

/** POST /api/personal/notes — create */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { data, error } = await supabase
    .from("personal_notes")
    .insert({
      user_id: auth.user.id,
      title: body?.title?.trim() || "새 노트",
      content: body?.content || "",
      parent_id: body?.parent_id || null,
      icon: body?.icon || null,
      tags: Array.isArray(body?.tags) ? body.tags : [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ row: data });
}

/** PATCH /api/personal/notes?id=... */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  for (const k of ["title", "content", "icon", "tags", "is_favorite", "is_archived", "parent_id", "sort_order"]) {
    if (k in body) patch[k] = body[k];
  }

  // Parse [[wikilinks]] from content on save
  if (typeof patch.content === "string") {
    const matches = Array.from((patch.content as string).matchAll(/\[\[([^\]]+)\]\]/g)).map((m) => m[1].trim()).filter(Boolean);
    const unique = [...new Set(matches)];
    if (unique.length > 0) {
      const { data: linked } = await supabase
        .from("personal_notes")
        .select("id, title")
        .eq("user_id", auth.user.id)
        .in("title", unique);
      patch.backlinks = (linked || []).map((n) => ({ id: n.id, title: n.title }));
    } else {
      patch.backlinks = [];
    }
  }

  const { data, error } = await supabase
    .from("personal_notes")
    .update(patch)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select()
    .single();

  if (error) {
    // Graceful fallback if backlinks column not yet migrated
    if (/backlinks.*column.*does not exist/i.test(error.message) && "backlinks" in patch) {
      delete patch.backlinks;
      const retry = await supabase
        .from("personal_notes")
        .update(patch)
        .eq("id", id)
        .eq("user_id", auth.user.id)
        .select()
        .single();
      if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 });
      return NextResponse.json({ row: retry.data });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ row: data });
}

/** DELETE /api/personal/notes?id=... */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("personal_notes")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
