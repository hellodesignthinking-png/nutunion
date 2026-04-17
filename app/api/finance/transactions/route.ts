import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { date, company, type, description, amount, category, memo, receipt_type, vendor_name, payment_method } = body || {};

    // 기본 검증
    if (!date || !company || !description || amount === undefined) {
      return NextResponse.json({ error: "필수 항목이 누락되었습니다" }, { status: 400 });
    }
    const amt = Number(amount);
    if (isNaN(amt)) {
      return NextResponse.json({ error: "금액이 올바르지 않습니다" }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)" }, { status: 400 });
    }

    const record = {
      id: Date.now(),
      date,
      company,
      type: type || "기타",
      description: description.trim(),
      amount: amt,
      category: category || "미분류",
      memo: memo || null,
      receipt_type: receipt_type || null,
      vendor_name: vendor_name || null,
      payment_method: payment_method || null,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("transactions").insert(record);
    if (error) {
      console.error("[Transactions POST]", error);
      return NextResponse.json({ error: "저장에 실패했습니다" }, { status: 500 });
    }

    return NextResponse.json({ success: true, transaction: record });
  } catch (err) {
    console.error("[Transactions POST]", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
