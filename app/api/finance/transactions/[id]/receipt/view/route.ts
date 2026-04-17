import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveFileUrl, isStorageRef } from "@/lib/finance/storage";

/**
 * GET /api/finance/transactions/[id]/receipt/view
 *
 * 영수증 URL 해석:
 *   · Storage 참조 (storage:bucket/path) → signed URL 생성 (1시간 유효)
 *   · base64 data URL → 그대로 반환 (하위 호환)
 *   · http(s) URL → 그대로 반환
 *
 * 반환: { url: string | null }
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: tx } = await supabase
    .from("transactions")
    .select("receipt_url")
    .eq("id", id)
    .maybeSingle();

  if (!tx) return NextResponse.json({ error: "거래 없음" }, { status: 404 });
  const raw = tx.receipt_url as string | null;
  if (!raw) return NextResponse.json({ url: null });

  const url = await resolveFileUrl(supabase, raw, { expiresIn: 3600 });
  return NextResponse.json({
    url,
    is_storage: isStorageRef(raw),
  });
}
