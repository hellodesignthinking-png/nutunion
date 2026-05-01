import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/contracts/esign/webhook
 * 모두싸인 / eformsign 웹훅 수신 — 서명 진행 이벤트 업데이트.
 */
export const POST = withRouteLog("contracts.esign.webhook", async (req: Request) => {
  const raw = await req.text();
  let payload: any;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "env missing" }, { status: 501 });
  const db = createClient(url, key, { auth: { persistSession: false } });

  // 모두싸인: document.id / event / status / downloadUrl
  const documentId = payload.documentId || payload.data?.document?.id;
  const eventType = payload.event || payload.type;
  const status = payload.data?.document?.status || payload.status;
  const pdfUrl = payload.data?.document?.downloadUrl || null;

  if (!documentId) return NextResponse.json({ error: "documentId missing" }, { status: 400 });

  const { data: contract } = await db
    .from("project_contracts")
    .select("id")
    .eq("esign_document_id", documentId)
    .maybeSingle();

  if (contract) {
    await db.from("esign_events").insert({
      contract_id: contract.id,
      provider: "modusign",
      event_type: eventType || "unknown",
      raw_payload: payload,
    });

    const patch: any = { esign_status: status || eventType, updated_at: new Date().toISOString() };
    if (pdfUrl) patch.esign_pdf_url = pdfUrl;
    if (status === "completed" || eventType === "completed") {
      patch.status = "signed";
      patch.client_signed_at = new Date().toISOString();
      patch.contractor_signed_at = new Date().toISOString();
    }
    await db.from("project_contracts").update(patch).eq("id", contract.id);
  }

  return NextResponse.json({ ok: true });
});
