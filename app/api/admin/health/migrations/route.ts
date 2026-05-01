import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/health/migrations
 *
 * 운영 환경 DB 에 어떤 최근 마이그레이션이 적용됐는지 체크.
 * 적용 여부는 table/column/function 존재 확인으로 추론 (실제 migrations 테이블은 Supabase CLI 만 쓰므로).
 *
 * admin/staff 전용.
 */

interface Check {
  id: string;
  label: string;
  status: "applied" | "missing" | "error";
  hint?: string;
  detail?: string;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin" && profile?.role !== "staff") {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  const checks: Check[] = [];

  // 062: venture_sources 테이블
  checks.push(await checkTable(supabase, "062_venture_sources", "Venture Source Library", "venture_sources"));

  // 063: projects.finance_snapshot 컬럼 + compute RPC
  checks.push(await checkColumn(supabase, "063_finance_snapshot_col", "자금/보상 스냅샷 컬럼", "projects", "finance_snapshot"));
  checks.push(await checkFunction(supabase, "063_compute_finance_rpc", "자금 집계 RPC", "compute_project_finance_snapshot"));

  // 064: venture_prototype_tasks.image_urls + venture_activity_feed RPC
  checks.push(await checkColumn(supabase, "064_prototype_images", "프로토타입 이미지 컬럼", "venture_prototype_tasks", "image_urls"));
  checks.push(await checkFunction(supabase, "064_activity_feed", "Venture 아카이브 RPC", "venture_activity_feed"));
  checks.push(await checkFunction(supabase, "064_daily_activity", "일별 활동 RPC", "venture_daily_activity"));

  // 065: wiki_synthesis_inputs
  checks.push(await checkTable(supabase, "065_synthesis_inputs", "Wiki AI 분석 추적", "wiki_synthesis_inputs"));
  checks.push(await checkFunction(supabase, "065_record_inputs", "분석 기록 RPC", "record_wiki_synthesis_inputs"));

  const applied = checks.filter((c) => c.status === "applied").length;
  const missing = checks.filter((c) => c.status === "missing").length;
  const errors = checks.filter((c) => c.status === "error").length;

  return NextResponse.json({
    ok: missing === 0 && errors === 0,
    summary: { total: checks.length, applied, missing, errors },
    checks,
  });
}

// ── 체크 헬퍼 ──────────────────────────────────────
async function checkTable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  label: string,
  table: string
): Promise<Check> {
  try {
    const { error } = await supabase.from(table).select("*", { count: "exact", head: true }).limit(0);
    if (error) {
      if (error.message.includes("does not exist") || error.message.includes("relation")) {
        return { id, label, status: "missing", hint: `supabase/migrations/${id.slice(0, 3)}_*.sql 실행` };
      }
      return { id, label, status: "error", detail: error.message };
    }
    return { id, label, status: "applied" };
  } catch (err) {
    log.error(err, "admin.health.migrations.failed");
    return { id, label, status: "error", detail: err instanceof Error ? err.message : "unknown" };
  }
}

async function checkColumn(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  label: string,
  table: string,
  column: string
): Promise<Check> {
  try {
    const { error } = await supabase.from(table).select(column).limit(0);
    if (error) {
      if (error.message.includes("does not exist") || error.message.includes("column")) {
        return { id, label, status: "missing", hint: `ALTER TABLE ${table} ADD COLUMN ${column}` };
      }
      return { id, label, status: "error", detail: error.message };
    }
    return { id, label, status: "applied" };
  } catch (err) {
    log.error(err, "admin.health.migrations.failed");
    return { id, label, status: "error", detail: err instanceof Error ? err.message : "unknown" };
  }
}

async function checkFunction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  label: string,
  func: string
): Promise<Check> {
  try {
    // 함수 이름만 확인 — 호출 실패도 함수 존재는 확인됨
    // UUID 로 null 전달 → 함수 시그니처와 다른 인자 에러 vs does not exist 구분
    const { error } = await supabase.rpc(func as never, {} as never);
    if (error) {
      if (error.message.includes("Could not find the function") || error.message.includes("does not exist")) {
        return { id, label, status: "missing", hint: `RPC ${func} 미생성 — 해당 마이그레이션 실행 필요` };
      }
      // 다른 에러 (인자 부족 등) 는 함수 자체는 존재
      return { id, label, status: "applied", detail: "함수 존재 (파라미터 확인 불가)" };
    }
    return { id, label, status: "applied" };
  } catch (err) {
    log.error(err, "admin.health.migrations.failed");
    return { id, label, status: "error", detail: err instanceof Error ? err.message : "unknown" };
  }
}
