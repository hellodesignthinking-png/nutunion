import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCompanyTransactions } from "@/lib/finance/company-queries";
import { parseYearMonth, firstDayOfMonth, lastDayOfMonth } from "@/lib/finance/date-utils";
import { writeAuditLog, extractRequestMeta } from "@/lib/finance/audit-log";
import { checkRateLimit, rateLimitResponse } from "@/lib/finance/rate-limit";

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

  // rate limit: 분당 5회 (대량 데이터 export 오남용 방지)
  const rl = await checkRateLimit(supabase, `${user.id}:tx-export`, 5, 60);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company") || "all";
  const monthParam = searchParams.get("month") || undefined;
  const { ym, y, m } = parseYearMonth(monthParam);
  const fromDate = firstDayOfMonth(ym);
  const toDate = lastDayOfMonth(y, m);

  // CSV는 전체 레코드 반환 (페이지 제한 우회)
  const { company: companyMeta, transactions } = await getCompanyTransactions(company, { fromDate, toDate, limit: 10000 });
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

  // 감사 로그: 누가 어떤 범위의 데이터를 export 했는지 기록
  await writeAuditLog(supabase, user, {
    entity_type: "transaction",
    action: "delete",  // export 액션이 없어 delete 로 대체 — 별도 action 추가도 고려
    company: company !== "all" ? company : null,
    summary: `거래 CSV 내보내기: ${companyMeta.name} ${ym} (${transactions.length}건)`,
    diff: { export: { company, month: ym, count: transactions.length } },
    actor_role: profile.role,
  }, extractRequestMeta(req));

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
    },
  });
}
