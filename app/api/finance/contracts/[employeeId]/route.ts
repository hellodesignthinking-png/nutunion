import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog, extractRequestMeta } from "@/lib/finance/audit-log";

async function checkPermission() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, message: "Unauthorized", userId: "" };
  const { data: profile } = await supabase.from("profiles").select("role,email").eq("id", user.id).single();
  if (!profile) return { ok: false as const, status: 403, message: "Forbidden", userId: "" };
  return { ok: true as const, supabase, user, userId: user.id, role: profile.role, email: profile.email };
}

/**
 * POST /api/finance/contracts/[employeeId]
 * action: "send" | "sign" | "cancel"
 */
export async function POST(req: NextRequest, context: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await context.params;
  const check = await checkPermission();
  if (!check.ok) return NextResponse.json({ error: check.message }, { status: check.status });

  const body = await req.json();
  const action = body.action as string;

  // 직원 조회
  const { data: employee } = await check.supabase.from("employees").select("*").eq("id", employeeId).single();
  if (!employee) return NextResponse.json({ error: "직원을 찾을 수 없습니다" }, { status: 404 });

  const isAdminStaff = check.role === "admin" || check.role === "staff";
  const isOwner = check.email && employee.email && check.email.toLowerCase() === employee.email.toLowerCase();

  const today = new Date().toISOString().slice(0, 10);
  const meta = extractRequestMeta(req);

  if (action === "send") {
    if (!isAdminStaff) return NextResponse.json({ error: "발송 권한이 없습니다" }, { status: 403 });
    if (employee.status === "퇴직") {
      return NextResponse.json({ error: "퇴직 직원에게는 계약서를 발송할 수 없습니다" }, { status: 400 });
    }
    if (!employee.email) {
      return NextResponse.json({ error: "직원 이메일이 등록되어 있지 않습니다" }, { status: 400 });
    }
    const { error } = await check.supabase
      .from("employees")
      .update({ contract_status: "sent", contract_sent_date: today })
      .eq("id", employeeId);
    if (error) return NextResponse.json({ error: "발송 실패" }, { status: 500 });

    await writeAuditLog(check.supabase, check.user, {
      entity_type: "contract",
      entity_id: employeeId,
      action: "send",
      company: employee.company,
      summary: `근로계약서 발송: ${employee.name} (${employee.email})`,
      diff: { after: { contract_status: "sent", contract_sent_date: today } },
      actor_role: check.role,
    }, meta);

    return NextResponse.json({ success: true, contract_status: "sent", contract_sent_date: today });
  }

  if (action === "sign") {
    if (!isOwner && !isAdminStaff) {
      return NextResponse.json({ error: "서명 권한이 없습니다" }, { status: 403 });
    }
    // 서명 이미지 검증 (data:image/png;base64,... 형식)
    const signatureImage = body.signature_image as string | undefined;
    if (signatureImage && (!signatureImage.startsWith("data:image/") || signatureImage.length > 500_000)) {
      return NextResponse.json({ error: "잘못된 서명 이미지입니다" }, { status: 400 });
    }
    const updates: Record<string, unknown> = {
      contract_status: "completed",
      contract_signed: true,
      contract_date: today,
    };
    if (signatureImage) updates.signature_image = signatureImage;
    const { error } = await check.supabase.from("employees").update(updates).eq("id", employeeId);
    if (error) {
      console.error("[Contracts sign]", error);
      return NextResponse.json({ error: "서명 저장 실패" }, { status: 500 });
    }

    await writeAuditLog(check.supabase, check.user, {
      entity_type: "contract",
      entity_id: employeeId,
      action: "sign",
      company: employee.company,
      summary: `근로계약서 서명 완료: ${employee.name}${isOwner ? " (본인)" : " (관리자 대신 서명)"}`,
      diff: { after: { contract_status: "completed", contract_date: today, signed_by_owner: !!isOwner } },
      actor_role: check.role,
    }, meta);

    return NextResponse.json({ success: true, contract_status: "completed", contract_date: today });
  }

  if (action === "cancel") {
    if (!isAdminStaff) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    const { error } = await check.supabase
      .from("employees")
      .update({ contract_status: null, contract_sent_date: null })
      .eq("id", employeeId);
    if (error) return NextResponse.json({ error: "취소 실패" }, { status: 500 });

    await writeAuditLog(check.supabase, check.user, {
      entity_type: "contract",
      entity_id: employeeId,
      action: "cancel",
      company: employee.company,
      summary: `근로계약서 발송 취소: ${employee.name}`,
      diff: { before: { contract_status: employee.contract_status, contract_sent_date: employee.contract_sent_date } },
      actor_role: check.role,
    }, meta);

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "지원하지 않는 action입니다" }, { status: 400 });
}
