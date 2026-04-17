import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCompanyTransactions } from "@/lib/finance/company-queries";
import { parseYearMonth, firstDayOfMonth, lastDayOfMonth } from "@/lib/finance/date-utils";

function csvEscape(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  // 권한 체크
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company") || "all";
  const monthParam = searchParams.get("month") || undefined;
  const { ym, y, m } = parseYearMonth(monthParam);
  const fromDate = firstDayOfMonth(ym);
  const toDate = lastDayOfMonth(y, m);

  const { company: companyMeta, transactions } = await getCompanyTransactions(company, { fromDate, toDate });
  if (!companyMeta) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  // CSV 생성
  const headers = [
    "날짜", "법인", "유형", "내용", "카테고리", "금액", "증빙", "거래처", "사업자번호", "결제수단", "메모",
  ];
  const lines = [headers.join(",")];

  // company name lookup (all 선택 시 거래 각각의 company 표시)
  const { data: allCompanies } = await supabase.from("companies").select("id,name");
  const companyMap = new Map((allCompanies || []).map((c) => [c.id, c.name]));

  transactions.forEach((t) => {
    const row = [
      t.date,
      companyMap.get(t.company) || t.company,
      t.type,
      t.description,
      t.category,
      t.amount,
      t.receipt_type,
      t.vendor_name,
      t.vendor_biz_no,
      t.payment_method,
      t.memo,
    ].map(csvEscape);
    lines.push(row.join(","));
  });

  const csv = lines.join("\n");
  // UTF-8 BOM으로 Excel 호환
  const body = "\uFEFF" + csv;

  const filename = `거래내역_${companyMeta.name}_${ym}.csv`;
  const encoded = encodeURIComponent(filename);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
    },
  });
}
