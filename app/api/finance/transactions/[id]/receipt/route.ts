import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog, extractRequestMeta } from "@/lib/finance/audit-log";
import { checkRateLimit, rateLimitResponse } from "@/lib/finance/rate-limit";
import { validateDataUrl } from "@/lib/finance/validators";
import {
  uploadDataUrl,
  deleteStorageRef,
  RECEIPT_BUCKET,
  isStorageRef,
} from "@/lib/finance/storage";

const MAX_RECEIPT_SIZE = 1_000_000; // 1MB base64 (~750KB raw)

/**
 * PUT /api/finance/transactions/[id]/receipt
 * body: { receipt_url: string | null }
 *   · data: URL 을 받으면 Supabase Storage 에 업로드 후 참조 저장
 *   · null 이면 기존 Storage 객체 삭제 + DB null 처리
 */
export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rl = await checkRateLimit(supabase, `${user.id}:receipt-upload`, 10, 60);
    if (!rl.allowed) return rateLimitResponse(rl);

    const body = await req.json();
    const incoming = body.receipt_url as string | null;

    // 기존 receipt_url 조회 — Storage 객체 삭제를 위해
    const { data: existing } = await supabase
      .from("transactions")
      .select("receipt_url")
      .eq("id", id)
      .maybeSingle();
    const oldUrl = (existing?.receipt_url ?? null) as string | null;

    let newValue: string | null = null;

    if (incoming !== null && incoming !== undefined) {
      if (typeof incoming !== "string") {
        return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
      }
      const validation = validateDataUrl(incoming, {
        allowPdf: true,
        maxBase64Length: MAX_RECEIPT_SIZE,
      });
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      if (incoming.startsWith("data:")) {
        // Storage 에 업로드
        try {
          const upload = await uploadDataUrl(supabase, {
            bucket: RECEIPT_BUCKET,
            prefix: `tx-${id}`,
            dataUrl: incoming,
          });
          newValue = upload.ref;
        } catch (uploadErr) {
    log.error(uploadErr, "finance.transactions.id.receipt.failed");
          console.error("[Receipt upload]", uploadErr);
          return NextResponse.json(
            { error: uploadErr instanceof Error ? uploadErr.message : "업로드 실패" },
            { status: 500 }
          );
        }
      } else {
        // http(s) URL passthrough (외부 링크 저장)
        newValue = incoming;
      }
    }

    const { error } = await supabase
      .from("transactions")
      .update({ receipt_url: newValue })
      .eq("id", id);
    if (error) {
      console.error("[Receipt PUT]", error);
      return NextResponse.json({ error: "저장 실패" }, { status: 500 });
    }

    // 기존 Storage 객체 정리 (교체/삭제 시). base64/http 는 skip
    if (oldUrl && isStorageRef(oldUrl) && oldUrl !== newValue) {
      const delResult = await deleteStorageRef(supabase, oldUrl);
      if (!delResult.ok) {
        console.warn("[Receipt] 기존 Storage 객체 삭제 실패:", delResult.error);
        // 로깅만 — 본 작업은 이미 성공
      }
    }

    await writeAuditLog(supabase, user, {
      entity_type: "receipt",
      entity_id: id,
      action: newValue === null ? "delete" : "update",
      summary: newValue === null ? `영수증 삭제 (거래 ${id})` : `영수증 첨부 (거래 ${id})`,
      actor_role: profile.role,
    }, extractRequestMeta(req));

    return NextResponse.json({ success: true });
  } catch (err) {
    log.error(err, "finance.transactions.id.receipt.failed");
    console.error("[Receipt PUT]", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
