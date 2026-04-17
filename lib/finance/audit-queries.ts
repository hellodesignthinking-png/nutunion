import { createClient } from "@/lib/supabase/server";

export interface FinanceAuditLog {
  id: number;
  actor_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  company: string | null;
  summary: string | null;
  diff: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditFilter {
  entityType?: string;
  action?: string;
  actorEmail?: string;
  company?: string;
  since?: string; // ISO date
  limit?: number;
  offset?: number;
}

export async function getAuditLogs(filter: AuditFilter = {}): Promise<{ logs: FinanceAuditLog[]; total: number }> {
  const supabase = await createClient();
  const limit = Math.min(filter.limit ?? 50, 200);
  const offset = filter.offset ?? 0;

  let countQuery = supabase.from("finance_audit_logs").select("*", { count: "exact", head: true });
  let dataQuery = supabase
    .from("finance_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filter.entityType) {
    countQuery = countQuery.eq("entity_type", filter.entityType);
    dataQuery = dataQuery.eq("entity_type", filter.entityType);
  }
  if (filter.action) {
    countQuery = countQuery.eq("action", filter.action);
    dataQuery = dataQuery.eq("action", filter.action);
  }
  if (filter.actorEmail) {
    countQuery = countQuery.ilike("actor_email", `%${filter.actorEmail}%`);
    dataQuery = dataQuery.ilike("actor_email", `%${filter.actorEmail}%`);
  }
  if (filter.company) {
    countQuery = countQuery.eq("company", filter.company);
    dataQuery = dataQuery.eq("company", filter.company);
  }
  if (filter.since) {
    countQuery = countQuery.gte("created_at", filter.since);
    dataQuery = dataQuery.gte("created_at", filter.since);
  }

  const [{ data, error }, { count }] = await Promise.all([dataQuery, countQuery]);
  if (error) {
    console.error("[audit-queries]", error);
    return { logs: [], total: 0 };
  }
  return { logs: (data as FinanceAuditLog[]) ?? [], total: count ?? 0 };
}

/** 엔터티 타입별 카운트 (최근 7일) */
export async function getAuditStatsLast7Days(): Promise<{ entityType: string; count: number }[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("finance_audit_logs")
    .select("entity_type")
    .gte("created_at", since);
  if (!data) return [];
  const map = new Map<string, number>();
  for (const row of data as { entity_type: string }[]) {
    map.set(row.entity_type, (map.get(row.entity_type) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([entityType, count]) => ({ entityType, count }))
    .sort((a, b) => b.count - a.count);
}
