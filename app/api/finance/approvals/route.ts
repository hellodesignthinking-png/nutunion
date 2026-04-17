import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog, extractRequestMeta } from "@/lib/finance/audit-log";

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

    const body = await req.json();
    const { title, doc_type, content, amount, company, attachments } = body || {};

    if (!title?.trim() || !doc_type) {
      return NextResponse.json({ error: "제목과 유형은 필수입니다" }, { status: 400 });
    }

    // 요청자 직원 정보
    const { data: emp } = profile.email
      ? await supabase.from("employees").select("id,position,department,company").eq("email", profile.email).maybeSingle()
      : { data: null };

    const record = {
      id: Date.now(),
      title: title.trim(),
      doc_type,
      content: content?.trim() || "",
      amount: amount ? Number(amount) : null,
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

    const { error } = await supabase.from("approvals").insert(record);
    if (error) {
      console.error("[Approvals POST]", error);
      return NextResponse.json({ error: "저장 실패" }, { status: 500 });
    }

    await writeAuditLog(supabase, user, {
      entity_type: "approval",
      entity_id: record.id,
      action: "create",
      company: record.company,
      summary: `결재 상신: [${record.doc_type}] ${record.title}${record.amount ? ` (₩${record.amount.toLocaleString()})` : ""}`,
      diff: { after: record },
      actor_role: profile.role,
    }, extractRequestMeta(req));

    return NextResponse.json({ success: true, approval: record });
  } catch (err) {
    console.error("[Approvals POST]", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
