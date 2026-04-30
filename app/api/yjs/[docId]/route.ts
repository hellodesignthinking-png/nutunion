import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/yjs/[docId]
 *  → { state: base64 | null }   (latest Y.Doc snapshot)
 *
 * POST /api/yjs/[docId]  body: { state: base64 }
 *  → upserts the snapshot. Caller must be authorized for the underlying
 *    resource per RLS policy on yjs_documents.
 *
 * Doc id format (this iteration): "personal_notes:{note_id}".
 */

function decodeDocId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

async function authorizeDocId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  docId: string
): Promise<boolean> {
  // personal_notes:{uuid} → user must own the note
  if (docId.startsWith("personal_notes:")) {
    const noteId = docId.slice("personal_notes:".length);
    if (!noteId) return false;
    const { data, error } = await supabase
      .from("personal_notes")
      .select("id")
      .eq("id", noteId)
      .eq("user_id", userId)
      .maybeSingle();
    return !error && !!data;
  }
  // No other namespaces allowed yet.
  return false;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ docId: string }> }
) {
  const { docId: rawDocId } = await ctx.params;
  const docId = decodeDocId(rawDocId);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const allowed = await authorizeDocId(supabase, auth.user.id, docId);
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("yjs_documents")
    .select("state, updated_at")
    .eq("doc_id", docId)
    .maybeSingle();

  if (error) {
    if (/relation.*yjs_documents.*does not exist/i.test(error.message)) {
      return NextResponse.json({ state: null, migration_needed: 124 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) return NextResponse.json({ state: null });

  // Supabase returns bytea as a hex string ("\\x...") in JSON. Convert to base64.
  let b64: string | null = null;
  const raw = data.state as unknown;
  if (typeof raw === "string" && raw.startsWith("\\x")) {
    const hex = raw.slice(2);
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    b64 = Buffer.from(bytes).toString("base64");
  } else if (raw && typeof raw === "object" && "data" in (raw as Record<string, unknown>)) {
    // Some clients return { type: 'Buffer', data: number[] }
    const arr = (raw as { data: number[] }).data;
    b64 = Buffer.from(arr).toString("base64");
  } else if (typeof raw === "string") {
    b64 = raw;
  }

  return NextResponse.json({ state: b64, updated_at: data.updated_at });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ docId: string }> }
) {
  const { docId: rawDocId } = await ctx.params;
  const docId = decodeDocId(rawDocId);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const allowed = await authorizeDocId(supabase, auth.user.id, docId);
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const stateB64 = body?.state;
  if (typeof stateB64 !== "string" || stateB64.length === 0) {
    return NextResponse.json({ error: "state (base64) required" }, { status: 400 });
  }

  // Convert base64 → bytea hex literal that postgres accepts.
  const bytes = Buffer.from(stateB64, "base64");
  const hex = "\\x" + bytes.toString("hex");

  const { error } = await supabase.from("yjs_documents").upsert(
    {
      doc_id: docId,
      state: hex,
      updated_by: auth.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "doc_id" }
  );

  if (error) {
    if (/relation.*yjs_documents.*does not exist/i.test(error.message)) {
      return NextResponse.json({ error: "migration 124 not applied" }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
