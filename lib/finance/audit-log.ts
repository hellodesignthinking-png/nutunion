// Finance 시스템 감사 로그 헬퍼
// 사용:
//   await writeAuditLog(supabase, user, {
//     entity_type: "transaction",
//     entity_id: String(id),
//     action: "delete",
//     company: tx.company,
//     summary: `거래 삭제: ${tx.date} ${tx.description} ${tx.amount}`,
//     diff: { before: tx },
//   });

import type { SupabaseClient, User } from "@supabase/supabase-js";

export interface AuditEntry {
  entity_type: "transaction" | "employee" | "payroll" | "approval" | "contract" | "receipt" | "company" | "attendance";
  entity_id?: string | number | null;
  action: "create" | "update" | "delete" | "batch_delete" | "approve" | "reject" | "cancel" | "send" | "sign";
  company?: string | null;
  summary?: string;
  diff?: Record<string, unknown>;
  /** actor_role 이 이미 알려진 경우 직접 전달 (profiles 조회 1회 절약) */
  actor_role?: string | null;
}

/**
 * 감사 로그 기록. 실패해도 원 작업은 계속되도록 throw 하지 않고 console.error 로만 남김.
 * (감사 로그 기록 실패가 본 기능 장애를 일으키면 안 됨.)
 */
export async function writeAuditLog(
  supabase: SupabaseClient,
  user: User | null | undefined,
  entry: AuditEntry,
  meta?: { ip?: string; userAgent?: string }
): Promise<void> {
  try {
    let role = entry.actor_role ?? null;
    if (!role && user) {
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      role = data?.role ?? null;
    }

    const { error } = await supabase.from("finance_audit_logs").insert({
      actor_id: user?.id ?? null,
      actor_email: user?.email ?? null,
      actor_role: role,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id != null ? String(entry.entity_id) : null,
      action: entry.action,
      company: entry.company ?? null,
      summary: entry.summary ?? null,
      diff: entry.diff ?? null,
      ip: meta?.ip ?? null,
      user_agent: meta?.userAgent ?? null,
    });

    if (error) {
      console.error("[audit-log] insert failed:", error.message);
    }
  } catch (err) {
    console.error("[audit-log] unexpected error:", err);
  }
}

/**
 * Next.js Request 에서 IP / user-agent 추출.
 */
export function extractRequestMeta(req: Request): { ip?: string; userAgent?: string } {
  const h = req.headers;
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    undefined;
  const userAgent = h.get("user-agent") ?? undefined;
  return { ip, userAgent };
}
