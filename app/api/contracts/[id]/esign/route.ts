import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/contracts/[id]/esign
 * 모두싸인 전자서명 요청 생성.
 * Body: { provider?: 'modusign' | 'eformsign' (default modusign) }
 *
 * 환경변수:
 *   MODUSIGN_API_KEY     — 모두싸인 API 키
 *   MODUSIGN_USER_EMAIL  — 모두싸인 계정 이메일
 *   MODUSIGN_TEMPLATE_ID — (선택) 기본 템플릿 사용 시
 *
 * Docs: https://help.modusign.co.kr/hc/ko/articles/360050116831
 */
export const POST = withRouteLog("contracts.id.esign", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: contract } = await supabase
    .from("project_contracts")
    .select("id, title, terms_md, client_id, contractor_id, status, client_signature_name, contractor_signature_name, created_by")
    .eq("id", id)
    .maybeSingle();
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  // 양 당사자 / 생성자 / admin 만 호출 가능
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const canRun = contract.created_by === user.id || contract.client_id === user.id || contract.contractor_id === user.id || profile?.role === "admin";
  if (!canRun) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const apiKey = process.env.MODUSIGN_API_KEY;
  const userEmail = process.env.MODUSIGN_USER_EMAIL;

  if (!apiKey || !userEmail) {
    // 환경변수 미설정 시 graceful stub — UI 에서 "연동 설정 필요" 안내
    return NextResponse.json({
      stubbed: true,
      message: "MODUSIGN_API_KEY 미설정 — 전자서명 연동이 비활성화됐습니다",
      preview: {
        title: contract.title,
        length: contract.terms_md?.length ?? 0,
      },
    });
  }

  // 양 당사자 이메일 조회
  const [{ data: client }, { data: contractor }] = await Promise.all([
    contract.client_id ? supabase.from("profiles").select("email, name, nickname").eq("id", contract.client_id).maybeSingle() : Promise.resolve({ data: null }),
    contract.contractor_id ? supabase.from("profiles").select("email, name, nickname").eq("id", contract.contractor_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const participants = [
    client?.email && { role: "signer", name: (client as any).name || (client as any).nickname || "발주자", email: (client as any).email, signingOrder: 1 },
    contractor?.email && { role: "signer", name: (contractor as any).name || (contractor as any).nickname || "수주자", email: (contractor as any).email, signingOrder: 2 },
  ].filter(Boolean);

  if (participants.length < 2) {
    return NextResponse.json({ error: "양 당사자의 이메일이 프로필에 등록되어야 합니다" }, { status: 400 });
  }

  try {
    // 문서 생성 (MD → Plain text 로 전환. PDF 자동 생성은 모두싸인에서 처리)
    const createRes = await fetch("https://api.modusign.co.kr/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${userEmail}:${apiKey}`).toString("base64")}`,
      },
      body: JSON.stringify({
        title: contract.title,
        file: {
          name: `${contract.title}.txt`,
          mimeType: "text/plain",
          content: Buffer.from(contract.terms_md || "").toString("base64"),
        },
        participantMappings: participants.map((p: any) => ({
          role: p.role,
          name: p.name,
          signingOrder: p.signingOrder,
          signingMethod: { type: "EMAIL", value: p.email },
        })),
        requesterInputMappings: [
          { dataLabel: { name: "title", value: contract.title } },
        ],
      }),
    });
    const data = await createRes.json();
    if (!createRes.ok) throw new Error(data.message || "Document create failed");

    await supabase.from("project_contracts").update({
      esign_provider: "modusign",
      esign_document_id: data.id,
      esign_status: "sent",
      esign_embed_url: data.shortCutLink || null,
      status: "sent",
      updated_at: new Date().toISOString(),
    }).eq("id", id);

    return NextResponse.json({ success: true, documentId: data.id, embedUrl: data.shortCutLink });
  } catch (err: any) {
    log.error(err, "contracts.id.esign.failed");
    return NextResponse.json({ error: err.message || "eSign request failed" }, { status: 500 });
  }
});
