import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { contractsEnabled } from "@/lib/flags";
import { renderTemplate, calcWithholding, type ContractTemplateKey } from "@/lib/contracts/templates";

/**
 * POST /api/contracts — 계약서 생성
 * Body: { projectId, template, title, amount, startDate, endDate, clientId, contractorId }
 */
export const POST = withRouteLog("contracts.post", async (req: Request) => {
  if (!(await contractsEnabled())) {
    return NextResponse.json({ error: "기능이 아직 활성화되지 않았습니다" }, { status: 403 });
  }

  const body = await req.json();
  const { projectId, template, title, amount, startDate, endDate, clientId, contractorId } = body;

  if (!projectId || !title || !template) {
    return NextResponse.json({ error: "Missing projectId/title/template" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 이름 조회 (템플릿 렌더용)
  const [{ data: client }, { data: contractor }] = await Promise.all([
    clientId ? supabase.from("profiles").select("name, nickname").eq("id", clientId).maybeSingle() : Promise.resolve({ data: null }),
    contractorId ? supabase.from("profiles").select("name, nickname").eq("id", contractorId).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const termsMd = renderTemplate(template as ContractTemplateKey, {
    title,
    clientName: (client as any)?.name || (client as any)?.nickname || "발주자",
    contractorName: (contractor as any)?.name || (contractor as any)?.nickname || "수주자",
    amount: Number(amount) || 0,
    startDate: startDate || "",
    endDate: endDate || "",
  });

  const { data, error } = await supabase.from("project_contracts").insert({
    project_id: projectId,
    client_id: clientId || null,
    contractor_id: contractorId || null,
    template,
    title,
    contract_amount: Number(amount) || null,
    start_date: startDate || null,
    end_date: endDate || null,
    terms_md: termsMd,
    created_by: user.id,
    status: "draft",
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data.id, termsMd, withholding: calcWithholding(Number(amount) || 0) });
});

/**
 * PATCH /api/contracts?id=xxx — 서명 / 상태 업데이트
 * Body: { action: 'sign_client' | 'sign_contractor' | 'cancel', signatureName? }
 */
export const PATCH = withRouteLog("contracts.patch", async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { action, signatureName } = await req.json();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: contract } = await supabase
    .from("project_contracts")
    .select("id, client_id, contractor_id, client_signed_at, contractor_signed_at, status")
    .eq("id", id)
    .maybeSingle();
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: any = {};

  if (action === "sign_client") {
    if (contract.client_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    patch.client_signed_at = new Date().toISOString();
    patch.client_signature_name = signatureName || null;
    patch.status = contract.contractor_signed_at ? "signed" : "signed_by_client";
  } else if (action === "sign_contractor") {
    if (contract.contractor_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    patch.contractor_signed_at = new Date().toISOString();
    patch.contractor_signature_name = signatureName || null;
    patch.status = contract.client_signed_at ? "signed" : "signed_by_contractor";
  } else if (action === "cancel") {
    patch.status = "cancelled";
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  patch.updated_at = new Date().toISOString();
  const { error } = await supabase.from("project_contracts").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, status: patch.status });
});
