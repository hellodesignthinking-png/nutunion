/**
 * consulting-kit.ts — Torque Bolt 생성 시 자동 설치되는 Consulting Kit 유틸리티.
 *
 * 사용:
 *   await installConsultingKit(supabase, projectId)
 *
 * thread_installations 테이블이 없는 환경에서는 스킵 (migration 115 의존).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface KitThreadSpec {
  slug: string;
  visibility: "all" | "team_only" | "consultant_only" | "owner_only";
  position: number;
  config?: Record<string, unknown>;
}

export const CONSULTING_KIT_THREADS: KitThreadSpec[] = [
  { slug: "team-meetings",         visibility: "team_only",       position: 10 },
  { slug: "consultant-meetings",   visibility: "all",             position: 20 },
  { slug: "request-queue",         visibility: "all",             position: 30 },
  { slug: "kpi-dashboard",         visibility: "all",             position: 40 },
  { slug: "milestone",             visibility: "all",             position: 50 },
  { slug: "deliverables",          visibility: "all",             position: 60 },
  { slug: "risk-register",         visibility: "all",             position: 70 },
  { slug: "budget",                visibility: "all",             position: 80 },
  { slug: "decision-log",          visibility: "all",             position: 90 },
  { slug: "ai-copilot",            visibility: "team_only",       position: 100, config: { mode: "team" } },
  { slug: "ai-copilot",            visibility: "consultant_only", position: 110, config: { mode: "consultant" } },
];

/**
 * Torque Bolt에 Consulting Kit (11개 Thread) 자동 설치.
 * thread_installations 테이블과 threads 테이블에 의존.
 * 해당 테이블이 없으면 조용히 실패.
 */
export async function installConsultingKit(
  supabase: SupabaseClient,
  projectId: string,
): Promise<{ ok: boolean; installed: number; skipped: number; error?: string }> {
  try {
    // threads 테이블에서 slug → id 매핑 조회
    const { data: threads, error: tErr } = await supabase
      .from("threads")
      .select("id, slug")
      .in("slug", [...new Set(CONSULTING_KIT_THREADS.map((t) => t.slug))]);

    if (tErr) {
      // migration 115 미적용 환경 — 조용히 성공으로 반환
      console.warn("[consulting-kit] threads 테이블 없음, 설치 스킵:", tErr.message);
      return { ok: true, installed: 0, skipped: CONSULTING_KIT_THREADS.length };
    }

    const slugToId = Object.fromEntries((threads || []).map((t: any) => [t.slug, t.id]));
    let installed = 0;
    let skipped = 0;

    for (const spec of CONSULTING_KIT_THREADS) {
      const threadId = slugToId[spec.slug];
      if (!threadId) {
        // 해당 slug의 Thread가 아직 없으면 스킵 (향후 구현 예정)
        skipped++;
        continue;
      }

      const { error } = await supabase.from("thread_installations").upsert(
        {
          target_type: "bolt",
          target_id: projectId,
          thread_id: threadId,
          position: spec.position,
          visibility: spec.visibility,
          config: spec.config ?? null,
          is_active: true,
        },
        { onConflict: "target_type,target_id,thread_id" },
      );

      if (error) {
        console.warn(`[consulting-kit] ${spec.slug} 설치 실패:`, error.message);
        skipped++;
      } else {
        installed++;
      }
    }

    return { ok: true, installed, skipped };
  } catch (err: any) {
    console.error("[consulting-kit] 설치 오류:", err);
    return { ok: false, installed: 0, skipped: 0, error: err.message };
  }
}

/**
 * 현재 Torque Bolt에 설치된 Thread 목록 + 가시성 조회.
 */
export async function getTorqueThreads(
  supabase: SupabaseClient,
  projectId: string,
  userRole: "owner" | "team" | "consultant" | "observer",
): Promise<Array<KitThreadSpec & { id: string; is_active: boolean }>> {
  const { data, error } = await supabase
    .from("thread_installations")
    .select("id, thread:threads(slug), position, visibility, config, is_active")
    .eq("target_type", "bolt")
    .eq("target_id", projectId)
    .order("position");

  if (error || !data) return [];

  const visibilityFilter = (v: string): boolean => {
    if (v === "all") return true;
    if (v === "team_only")       return userRole === "owner" || userRole === "team";
    if (v === "consultant_only") return userRole === "owner" || userRole === "consultant";
    if (v === "owner_only")      return userRole === "owner";
    return false;
  };

  return data
    .filter((inst: any) => visibilityFilter(inst.visibility))
    .map((inst: any) => ({
      id:         inst.id,
      slug:       inst.thread?.slug ?? "",
      visibility: inst.visibility,
      position:   inst.position,
      config:     inst.config,
      is_active:  inst.is_active,
    }));
}
