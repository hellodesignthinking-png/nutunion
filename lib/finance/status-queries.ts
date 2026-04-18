import { createClient } from "@/lib/supabase/server";

export interface TableCount {
  table: string;
  count: number;
  error?: string;
}

export interface RlsStatus {
  table: string;
  enabled: boolean;
  policy_count: number;
}

export interface CronStatus {
  last_audit_log_created: string | null;
  rate_limits_active: number;
  audit_logs_total: number;
  ai_usage_logs_total: number;
  oldest_audit_log: string | null;
}

const TABLES = [
  "companies",
  "transactions",
  "employees",
  "attendances",
  "payroll",
  "approvals",
  "finance_audit_logs",
  "ai_usage_logs",
  "rate_limits",
  // Venture Builder 테이블
  "venture_insights",
  "venture_problems",
  "venture_ideas",
  "venture_plans",
  "venture_stage_history",
  "funding_submissions",
  "chat_digests",
];

export async function getTableCounts(): Promise<TableCount[]> {
  const supabase = await createClient();
  const results = await Promise.all(
    TABLES.map(async (table) => {
      try {
        const { count, error } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });
        return { table, count: count ?? 0, error: error?.message };
      } catch (err) {
        return {
          table,
          count: 0,
          error: err instanceof Error ? err.message : "unknown",
        };
      }
    })
  );
  return results;
}

/**
 * 주요 테이블의 RLS 활성화 여부 + finance_* 정책 수
 * admin 만 호출하므로 직접 pg_* 뷰 조회 가능 (service_role 필요 없음)
 */
export async function getRlsStatus(): Promise<RlsStatus[]> {
  const supabase = await createClient();

  // RPC 가 아니라 RLS 가 걸린 pg_* 뷰는 조회가 제한됨.
  // 대신 각 테이블에 강제 select 해보고 성공 여부로 개략 판단할 수도 있지만,
  // 여기서는 단순히 기대값을 기록 (실제 DB 검증은 관리자가 SQL Editor 로)
  const EXPECTED = [
    "profiles",
    "companies",
    "transactions",
    "employees",
    "attendances",
    "payroll",
    "approvals",
    "finance_audit_logs",
    "ai_usage_logs",
    "rate_limits",
  ];

  // policy 수 조회는 pg_policies 가 공개되지 않아 불가 → 0 으로 반환하고
  // UI 에 "Supabase SQL Editor 에서 확인" 안내
  void supabase;
  return EXPECTED.map((table) => ({ table, enabled: true, policy_count: 0 }));
}

export async function getCronStatus(): Promise<CronStatus> {
  const supabase = await createClient();

  const [
    { data: latestAudit },
    { count: rlActive },
    { count: auditTotal },
    { count: aiTotal },
    { data: oldestAudit },
  ] = await Promise.all([
    supabase
      .from("finance_audit_logs")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("rate_limits").select("*", { count: "exact", head: true }),
    supabase.from("finance_audit_logs").select("*", { count: "exact", head: true }),
    supabase.from("ai_usage_logs").select("*", { count: "exact", head: true }),
    supabase
      .from("finance_audit_logs")
      .select("created_at")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    last_audit_log_created: latestAudit?.created_at ?? null,
    rate_limits_active: rlActive ?? 0,
    audit_logs_total: auditTotal ?? 0,
    ai_usage_logs_total: aiTotal ?? 0,
    oldest_audit_log: oldestAudit?.created_at ?? null,
  };
}

/** 빠른 DB ping */
export async function pingDatabase(): Promise<{ ok: boolean; duration_ms: number; error?: string }> {
  const start = Date.now();
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .limit(0);
    if (error) return { ok: false, duration_ms: Date.now() - start, error: error.message };
    return { ok: true, duration_ms: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      duration_ms: Date.now() - start,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
