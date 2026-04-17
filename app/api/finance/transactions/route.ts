import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog, extractRequestMeta } from "@/lib/finance/audit-log";
import { checkRateLimit, rateLimitResponse } from "@/lib/finance/rate-limit";
import { TransactionCreateSchema, formatZodError } from "@/lib/finance/validators";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // rate limit: 분당 30건
    const rl = await checkRateLimit(supabase, `${user.id}:tx-create`, 30, 60);
    if (!rl.allowed) return rateLimitResponse(rl);

    const body = await req.json();
    const parsed = TransactionCreateSchema.safeParse({
      ...body,
      amount: typeof body?.amount === "string" ? Number(body.amount) : body?.amount,
    });
    if (!parsed.success) {
      return NextResponse.json(formatZodError(parsed.error), { status: 400 });
    }
    const { date, company, type, description, amount: amt, category, memo, receipt_type, vendor_name, payment_method } = parsed.data;

    // 중복 거래 감지 (같은 날짜/법인/금액/내용 — 최근 1시간 내)
    const { data: dupCheck } = await supabase
      .from("transactions")
      .select("id,created_at")
      .eq("date", date)
      .eq("company", company)
      .eq("amount", amt)
      .eq("description", description)
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .limit(1);
    if (dupCheck && dupCheck.length > 0 && !parsed.data.force_duplicate) {
      return NextResponse.json({
        error: "동일한 거래가 1시간 내에 이미 등록되어 있습니다",
        duplicate: true,
      }, { status: 409 });
    }

    const record = {
      date,
      company,
      type: type || "기타",
      description,
      amount: amt,
      category: category || "미분류",
      memo: memo ?? null,
      receipt_type: receipt_type ?? null,
      vendor_name: vendor_name ?? null,
      payment_method: payment_method ?? null,
      created_at: new Date().toISOString(),
    };

    // id 는 DB 시퀀스가 자동 할당 (050 마이그레이션)
    const { data: inserted, error } = await supabase
      .from("transactions")
      .insert(record)
      .select()
      .single();
    if (error) {
      console.error("[Transactions POST]", error);
      return NextResponse.json({ error: "저장에 실패했습니다" }, { status: 500 });
    }

    await writeAuditLog(supabase, user, {
      entity_type: "transaction",
      entity_id: inserted.id,
      action: "create",
      company: inserted.company,
      summary: `거래 등록: ${inserted.date} ${inserted.description} ${inserted.amount}`,
      diff: { after: inserted },
      actor_role: profile.role,
    }, extractRequestMeta(req));

    return NextResponse.json({ success: true, transaction: inserted });
  } catch (err) {
    console.error("[Transactions POST]", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
