import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { dispatchPushToUsers } from "@/lib/push/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/venture-reminder
 *
 * 매일 실행 — 72시간 이상 Venture 활동이 없는 활성 볼트를 찾아
 * 멤버들에게 리마인드 푸시 발송.
 *
 * 주의:
 *   - 활동 테이블 중 venture_stage_history 는 "__reminder__" 마커 프리픽스
 *     노트를 제외하고 조회 (자기참조 루프 방지).
 *   - 볼트당 최근 14일 이내 리마인드 1회 제한.
 */
const REMINDER_NOTE_PREFIX = "[auto-reminder]";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase admin 미설정" }, { status: 500 });
  }
  const admin = createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = Date.now();
  const IDLE_MS = 72 * 60 * 60 * 1000;
  const REMIND_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
  const threshold = new Date(now - IDLE_MS).toISOString();
  const cooldown = new Date(now - REMIND_COOLDOWN_MS).toISOString();

  // 페이지네이션 — 500건씩 순회
  const PAGE_SIZE = 500;
  const allProjects: { id: string; title: string }[] = [];
  for (let page = 0; page < 20; page++) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await admin
      .from("projects")
      .select("id, title")
      .eq("venture_mode", true)
      .is("closed_at", null)
      .neq("venture_stage", "completed")
      .range(from, to);
    if (error) {
      return NextResponse.json({ error: error.message, stage: "list_projects", page }, { status: 500 });
    }
    const rows = (data as { id: string; title: string }[] | null) ?? [];
    allProjects.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }

  let reminded = 0;
  let errors = 0;
  const results: Array<{ project_id: string; last_activity: string | null; reminded: boolean; members: number; skipReason?: string }> = [];

  for (const proj of allProjects) {
    try {
      // 병렬로 활동 조회
      const [insights, problems, ideas, tasks, feedback, history] = await Promise.all([
        admin.from("venture_insights").select("created_at").eq("project_id", proj.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        admin.from("venture_problems").select("created_at").eq("project_id", proj.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        admin.from("venture_ideas").select("created_at").eq("project_id", proj.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        admin.from("venture_prototype_tasks").select("created_at").eq("project_id", proj.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        admin.from("venture_feedback").select("created_at").eq("project_id", proj.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        // ★ 핵심 수정: 자기참조 방지 — 리마인더가 남긴 기록 제외
        admin.from("venture_stage_history")
          .select("changed_at, note")
          .eq("project_id", proj.id)
          .order("changed_at", { ascending: false })
          .limit(10),
      ]);

      const histActivity = ((history.data as { changed_at: string; note: string | null }[] | null) ?? [])
        .find((h) => !h.note?.startsWith(REMINDER_NOTE_PREFIX));

      const candidates = [
        insights.data?.created_at,
        problems.data?.created_at,
        ideas.data?.created_at,
        tasks.data?.created_at,
        feedback.data?.created_at,
        histActivity?.changed_at,
      ].filter((v): v is string => typeof v === "string");

      // 타임스탬프 비교는 Date.parse 기준 (문자열 정렬은 TZ 접미사 다양성에 불안정)
      const lastActivity = candidates.length > 0
        ? candidates.reduce((a, b) => (Date.parse(a) > Date.parse(b) ? a : b))
        : null;

      const idle = !lastActivity || Date.parse(lastActivity) < Date.parse(threshold);
      if (!idle) {
        results.push({ project_id: proj.id, last_activity: lastActivity, reminded: false, members: 0, skipReason: "active" });
        continue;
      }

      // 쿨다운 — 리마인드 마커 프리픽스로 엄격 매칭
      const { data: recentReminder } = await admin
        .from("venture_stage_history")
        .select("id, note")
        .eq("project_id", proj.id)
        .gte("changed_at", cooldown)
        .limit(50);

      const hasRecent = ((recentReminder as { id: string; note: string | null }[] | null) ?? [])
        .some((r) => r.note?.startsWith(REMINDER_NOTE_PREFIX));
      if (hasRecent) {
        results.push({ project_id: proj.id, last_activity: lastActivity, reminded: false, members: 0, skipReason: "cooldown" });
        continue;
      }

      // 멤버 조회
      const { data: members } = await admin
        .from("project_members")
        .select("user_id")
        .eq("project_id", proj.id);
      const userIds = [...new Set(((members as { user_id: string }[] | null) ?? []).map((m) => m.user_id))];
      if (userIds.length === 0) {
        results.push({ project_id: proj.id, last_activity: lastActivity, reminded: false, members: 0, skipReason: "no_members" });
        continue;
      }

      const daysIdle = lastActivity
        ? Math.floor((now - new Date(lastActivity).getTime()) / (24 * 60 * 60 * 1000))
        : null;

      await dispatchPushToUsers(userIds, {
        title: "🌡 Venture 온도계",
        body: daysIdle
          ? `"${proj.title}" — ${daysIdle}일째 활동 없음. 다음 단계로 진행해볼까요?`
          : `"${proj.title}" — 활동을 시작해주세요.`,
        url: `/projects/${proj.id}/venture`,
        tag: `venture-reminder-${proj.id}`,
      }).catch((err) => {
        console.error("[venture-reminder] push dispatch failed", proj.id, err);
      });

      // 쿨다운 기록 — 현재 stage 를 그대로 넣어 "진짜" stage 변경과 구분되도록 from==to + note 프리픽스
      const { data: currentProj } = await admin
        .from("projects")
        .select("venture_stage")
        .eq("id", proj.id)
        .maybeSingle();
      const curStage = (currentProj as { venture_stage: string } | null)?.venture_stage ?? "empathize";

      await admin.from("venture_stage_history").insert({
        project_id: proj.id,
        from_stage: curStage,
        to_stage: curStage,
        changed_by: null,
        note: `${REMINDER_NOTE_PREFIX} ${daysIdle ?? "?"}일 휴면 · ${userIds.length}명 발송`,
      }).then(
        () => {},
        (err) => console.error("[venture-reminder] history insert failed", proj.id, err)
      );

      reminded += 1;
      results.push({ project_id: proj.id, last_activity: lastActivity, reminded: true, members: userIds.length });
    } catch (err) {
      errors += 1;
      console.error("[venture-reminder] project failed", proj.id, err);
      results.push({ project_id: proj.id, last_activity: null, reminded: false, members: 0, skipReason: "error" });
    }
  }

  return NextResponse.json({
    success: true,
    checked: allProjects.length,
    reminded,
    errors,
    results: results.slice(0, 50),
  });
}
