import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { calcWithholding, calcVat } from "@/lib/contracts/templates";

/**
 * POST /api/tax-invoices/[id]/issue
 * Popbill API 로 세금계산서 / 원천징수영수증 발행.
 *
 * 환경변수:
 *   POPBILL_LINK_ID      — 사이트 식별자
 *   POPBILL_SECRET_KEY   — API Secret
 *   POPBILL_CORP_NUM     — 발행사 사업자번호 (숫자만)
 *   POPBILL_USER_ID      — 담당자 ID
 *   POPBILL_MODE         — 'TEST' | 'PRODUCTION'
 *
 * Docs: https://developers.popbill.com
 */
export const POST = withRouteLog("tax-invoices.id.issue.post", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: invoice } = await supabase
    .from("tax_invoices")
    .select("id, kind, supply_amount, vat_amount, withholding_amount, net_amount, contract_id, status, contract:project_contracts(contract_amount, contractor_id, client_id, title)")
    .eq("id", id)
    .maybeSingle();
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.status === "issued") {
    return NextResponse.json({ error: "이미 발행된 계산서입니다" }, { status: 400 });
  }

  const contract = Array.isArray(invoice.contract) ? invoice.contract[0] : invoice.contract;
  if (!contract) return NextResponse.json({ error: "Contract missing" }, { status: 400 });

  // 권한: 수주자(contractor) 또는 admin 만 발행 가능
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const canIssue = contract.contractor_id === user.id || profile?.role === "admin";
  if (!canIssue) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const linkId = process.env.POPBILL_LINK_ID;
  const secretKey = process.env.POPBILL_SECRET_KEY;
  const corpNum = process.env.POPBILL_CORP_NUM;
  const popbillUserId = process.env.POPBILL_USER_ID || "ADMIN";

  // 환경변수 없으면 stub — 로컬 원장만 issued 로 전환
  if (!linkId || !secretKey || !corpNum) {
    const mgtKey = `nutunion-${Date.now()}`;
    await supabase.from("tax_invoices").update({
      status: "issued",
      provider: "manual",
      provider_mgt_key: mgtKey,
      issue_number: `MANUAL-${mgtKey}`,
      issued_at: new Date().toISOString(),
    }).eq("id", id);
    return NextResponse.json({
      stubbed: true,
      message: "POPBILL env 미설정 — 수동 원장 기록만 진행",
      mgtKey,
    });
  }

  const mgtKey = `nu${Date.now()}`;
  const supplyAmount = invoice.supply_amount;
  const { vat } = calcVat(supplyAmount);

  try {
    // Popbill Taxinvoice 발행 — 실제 API 호출 구조
    const apiHost = process.env.POPBILL_MODE === "TEST" ? "https://popbill-test.linkhub.co.kr" : "https://popbill.linkhub.co.kr";

    const res = await fetch(`${apiHost}/Taxinvoice/${corpNum}?MgtKey=${mgtKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${await popbillToken(linkId, secretKey, corpNum, apiHost)}`,
        "x-pb-version": "1.0",
        "x-pb-message-digest": "",
        "x-pb-userid": popbillUserId,
      },
      body: JSON.stringify({
        writeDate: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
        chargeDirection: "정과금",
        issueType: "정발행",
        purposeType: "영수",
        taxType: "과세",
        invoicerCorpNum: corpNum,
        invoicerCorpName: "nutunion",
        invoicerMgtKey: mgtKey,
        supplyCostTotal: String(supplyAmount),
        taxTotal: String(vat),
        totalAmount: String(supplyAmount + vat),
        itemName: contract.title || "용역",
        invoiceeType: "사업자",
        invoiceeCorpNum: "0000000000",   // TODO: 실제 발주자 사업자번호 필요
        invoiceeCorpName: "발주자",
        invoiceeEmail1: "client@example.com",
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Popbill 발행 실패");

    await supabase.from("tax_invoices").update({
      status: "issued",
      provider: "popbill",
      provider_mgt_key: mgtKey,
      nts_confirm_num: data.ntsConfirmNum || null,
      issue_number: data.ntsConfirmNum || mgtKey,
      issued_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      raw_data: data,
    }).eq("id", id);

    await supabase.from("tax_invoice_events").insert({
      invoice_id: id,
      provider: "popbill",
      event_type: "issued",
      raw_payload: data,
    });

    return NextResponse.json({ success: true, mgtKey, ntsConfirmNum: data.ntsConfirmNum });
  } catch (err: any) {
    log.error(err, "tax-invoices.id.issue.failed");
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});

async function popbillToken(linkId: string, secretKey: string, corpNum: string, apiHost: string): Promise<string> {
  // 간략화 — 실제 운영 시 토큰 캐시 + 시그니처 필요
  const res = await fetch(`${apiHost}/${corpNum}/Token`, {
    method: "POST",
    headers: {
      "x-pb-linkid": linkId,
      "x-pb-secretkey": secretKey,
    },
    body: JSON.stringify({ access_id: corpNum }),
  });
  const data = await res.json();
  return data.session_token || "";
}

/**
 * 원천징수영수증 PDF 생성 — Contract 에서 사용 (서버 사이드 HTML → PDF)
 */
export const GET = withRouteLog("tax-invoices.id.issue.get", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: inv } = await supabase
    .from("tax_invoices")
    .select("*, contract:project_contracts(title, client_id, contractor_id, contract_amount)")
    .eq("id", id)
    .maybeSingle();
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const wh = calcWithholding(inv.supply_amount);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>원천징수영수증</title>
    <style>body{font-family:'Apple SD Gothic Neo',sans-serif;padding:40px;max-width:700px;margin:auto}
    h1{text-align:center;border-bottom:3px solid #000;padding-bottom:10px}
    table{width:100%;border-collapse:collapse;margin:20px 0}
    td,th{border:1px solid #ccc;padding:8px;text-align:left}
    .total{font-size:20px;font-weight:bold;color:#FF3D88}</style></head>
    <body>
    <h1>원천징수 영수증</h1>
    <table>
      <tr><th>지급일자</th><td>${inv.issued_at || new Date().toISOString().slice(0,10)}</td></tr>
      <tr><th>공급가액</th><td>₩${inv.supply_amount.toLocaleString('ko-KR')}</td></tr>
      <tr><th>원천징수(3.3%)</th><td>₩${wh.withholding.toLocaleString('ko-KR')}</td></tr>
      <tr><th>실지급액</th><td class="total">₩${wh.net.toLocaleString('ko-KR')}</td></tr>
    </table>
    <p style="margin-top:40px;color:#666;font-size:12px">※ 본 영수증은 nutunion 에서 자동 발행한 참고용 문서입니다. 국세청 신고용으로는 세무사 검토가 필요합니다.</p>
    </body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
});
