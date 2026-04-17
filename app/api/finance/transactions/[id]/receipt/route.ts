import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog, extractRequestMeta } from "@/lib/finance/audit-log";
import { checkRateLimit, rateLimitResponse } from "@/lib/finance/rate-limit";

const MAX_RECEIPT_SIZE = 1_000_000; // 1MB base64 (~750KB raw)

/**
 * PUT /api/finance/transactions/[id]/receipt
 * body: { receipt_url: string }  // data:image/...;base64,... 또는 URL
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

    // rate limit: 분당 10건 (대용량 base64 업로드 제한)
    const rl = await checkRateLimit(supabase, `${user.id}:receipt-upload`, 10, 60);
    if (!rl.allowed) return rateLimitResponse(rl);

    const body = await req.json();
    const receiptUrl = body.receipt_url as string | null;

    if (receiptUrl !== null) {
      if (typeof receiptUrl !== "string") {
        return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
      }
      if (receiptUrl.startsWith("data:")) {
        if (receiptUrl.length > MAX_RECEIPT_SIZE) {
          return NextResponse.json({ error: "영수증 파일이 너무 큽니다 (최대 750KB). 이미지를 압축해주세요." }, { status: 400 });
        }
        if (!/^data:(image\/|application\/pdf)/.test(receiptUrl)) {
          return NextResponse.json({ error: "이미지 또는 PDF만 업로드 가능합니다" }, { status: 400 });
        }
      }
    }

    const { error } = await supabase
      .from("transactions")
      .update({ receipt_url: receiptUrl })
      .eq("id", id);
    if (error) {
      console.error("[Receipt PUT]", error);
      return NextResponse.json({ error: "저장 실패" }, { status: 500 });
    }

    await writeAuditLog(supabase, user, {
      entity_type: "receipt",
      entity_id: id,
      action: receiptUrl === null ? "delete" : "update",
      summary: receiptUrl === null ? `영수증 삭제 (거래 ${id})` : `영수증 첨부 (거래 ${id})`,
      actor_role: profile.role,
    }, extractRequestMeta(req));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Receipt PUT]", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
