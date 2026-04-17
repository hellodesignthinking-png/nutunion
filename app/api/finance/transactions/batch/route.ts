import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog, extractRequestMeta } from "@/lib/finance/audit-log";
import { checkRateLimit, rateLimitResponse } from "@/lib/finance/rate-limit";

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // rate limit: 분당 5건 (파괴적 액션이므로 타이트하게)
  const rl = await checkRateLimit(supabase, `${user.id}:tx-batch-delete`, 5, 60);
  if (!rl.allowed) return rateLimitResponse(rl);

  const body = await req.json();
  const ids: (string | number)[] = Array.isArray(body.ids) ? body.ids : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "삭제할 항목이 없습니다" }, { status: 400 });
  }
  if (ids.length > 100) {
    return NextResponse.json({ error: "한 번에 최대 100건까지 삭제 가능합니다" }, { status: 400 });
  }

  // 삭제 전 스냅샷 (감사 로그용)
  const { data: before } = await supabase
    .from("transactions")
    .select("id,date,company,amount,description")
    .in("id", ids);

  const { error, count } = await supabase
    .from("transactions")
    .delete({ count: "exact" })
    .in("id", ids);

  if (error) {
    console.error("[Transactions Batch DELETE]", error);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }

  await writeAuditLog(supabase, user, {
    entity_type: "transaction",
    action: "batch_delete",
    summary: `거래 일괄 삭제: ${count ?? 0}건`,
    diff: { ids, before: before ?? [] },
    actor_role: profile.role,
  }, extractRequestMeta(req));

  return NextResponse.json({ success: true, deleted: count ?? 0 });
}
