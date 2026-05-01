import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog, extractRequestMeta } from "@/lib/finance/audit-log";
import { checkRateLimit, rateLimitResponse } from "@/lib/finance/rate-limit";
import { ApprovalCreateSchema, formatZodError } from "@/lib/finance/validators";

/**
 * POST /api/finance/approvals — 결재 요청 작성
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("id,nickname,email,role").eq("id", user.id).single();
    if (!profile) return NextResponse.json({ error: "프로필 없음" }, { status: 403 });

    // rate limit: 분당 10건
    const rl = await checkRateLimit(supabase, `${user.id}:approval-create`, 10, 60);
    if (!rl.allowed) return rateLimitResponse(rl);

    const body = await req.json();
    const normalized = {
      ...body,
      amount: body?.amount !== undefined && body.amount !== "" && body.amount !== null ? Number(body.amount) : undefined,
    };
    const parsed = ApprovalCreateSchema.safeParse(normalized);
    if (!parsed.success) {
      return NextResponse.json(formatZodError(parsed.error), { status: 400 });
    }
    const { title, doc_type, content, amount, company, attachments } = parsed.data;

    // 요청자 직원 정보
    const { data: emp } = profile.email
      ? await supabase.from("employees").select("id,position,department,company").eq("email", profile.email).maybeSingle()
      : { data: null };

    const record = {
      title,
      doc_type,
      content: content || "",
      amount: amount ?? null,
      company: company || emp?.company || null,
      status: "대기",
      request_date: new Date().toISOString().slice(0, 10),
      requester_id: profile.id,
      requester_name: profile.nickname || null,
      requester_position: emp?.position || null,
      requester_department: emp?.department || null,
      employee_id: emp?.id ? String(emp.id) : null,
      attachments: attachments || null,
      created_at: new Date().toISOString(),
    };

    const { data: inserted, error } = await supabase
      .from("approvals")
      .insert(record)
      .select()
      .single();
    if (error) {
      console.error("[Approvals POST]", error);
      return NextResponse.json({ error: "저장 실패" }, { status: 500 });
    }

    await writeAuditLog(supabase, user, {
      entity_type: "approval",
      entity_id: inserted.id,
      action: "create",
      company: inserted.company,
      summary: `결재 상신: [${inserted.doc_type}] ${inserted.title}${inserted.amount ? ` (₩${inserted.amount.toLocaleString()})` : ""}`,
      diff: { after: inserted },
      actor_role: profile.role,
    }, extractRequestMeta(req));

    return NextResponse.json({ success: true, approval: inserted });
  } catch (err) {
    log.error(err, "finance.approvals.failed");
    console.error("[Approvals POST]", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
