/**
 * DELETE /api/projects/[id]/delete
 *
 * 볼트 삭제 — 서버 사이드. Supabase RLS 나 FK restrict 으로 클라이언트에서 직접
 * DELETE 가 막히는 경우 (migration 084 이후 서브타입 테이블 + bolt_metrics 등 참조 테이블
 * 누적) 를 우회하기 위해 service_role 로 자식 테이블을 순차 정리합니다.
 *
 * 권한:
 *  - 볼트 created_by 본인
 *  - project_members role='lead' 또는 'manager'
 *  - profiles.role='admin'
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: RouteCtx) {
  return handle(params);
}
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  return handle(params);
}

async function handle(params: Promise<{ id: string }>) {
  const { id } = await params;
  const supabase = await createServerClient();

  // 1) 인증 + 권한 체크
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [projRes, memberRes, profileRes] = await Promise.all([
    supabase.from("projects").select("id, created_by, title").eq("id", id).maybeSingle(),
    supabase
      .from("project_members")
      .select("role")
      .eq("project_id", id)
      .eq("user_id", auth.user.id)
      .maybeSingle(),
    supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle(),
  ]);

  if (!projRes.data) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }
  const project = projRes.data as any;
  const isOwner = project.created_by === auth.user.id;
  const isLead = memberRes.data && ["lead", "manager"].includes((memberRes.data as any).role);
  const isAdmin = (profileRes.data as any)?.role === "admin";
  if (!isOwner && !isLead && !isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 2) service_role 클라이언트 — RLS 우회
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svcKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE env 미설정 — 관리자에게 문의" },
      { status: 501 },
    );
  }
  const db = createAdminClient(url, svcKey, { auth: { persistSession: false } });

  // 3) 자식/참조 테이블 순차 정리 (FK restrict 또는 누락된 cascade 대비)
  //    존재하지 않는 테이블이 있으면 error 무시하고 계속.
  const cleanupTables = [
    // 서브타입 (migration 084) — cascade 걸려있지만 명시
    "project_anchor",
    "project_carriage",
    "project_eye",
    "project_wing",
    // 지표·탭 (migration 084/073/085)
    "bolt_metrics",
    "bolt_taps",
    // 기존 테이블
    "project_tasks",
    "project_milestones",
    "project_members",
    "project_applications",
    "project_updates",
    "project_events",
    "project_digests",
    "project_embeddings",
    // Admin 콘솔 과거 코드가 참조하던 테이블들 (존재 안 할 수도 있음)
    "project_resources",
    "project_action_items",
    "project_financial_records",
  ];

  // meetings — 중간 테이블 2개 선정리 후 meetings 자체 삭제
  try {
    const { data: meetings } = await db.from("meetings").select("id").eq("project_id", id);
    const meetingIds = ((meetings as any[]) || []).map((m: any) => m.id);
    if (meetingIds.length > 0) {
      await db.from("meeting_notes").delete().in("meeting_id", meetingIds);
      await db.from("meeting_agendas").delete().in("meeting_id", meetingIds);
    }
    await db.from("meetings").delete().eq("project_id", id);
  } catch {
    /* 테이블 미존재 등은 무시 */
  }

  const cleanup: Record<string, string> = {};
  for (const tbl of cleanupTables) {
    const { error } = await db.from(tbl).delete().eq("project_id", id);
    if (error) {
      cleanup[tbl] = error.message;
      // undefined_table 42P01 은 무시
      if (!/relation .+ does not exist|does not exist/i.test(error.message)) {
        console.warn(`[delete project] ${tbl}: ${error.message}`);
      }
    } else {
      cleanup[tbl] = "ok";
    }
  }

  // 4) 자식 볼트(parent_bolt_id=this) — NULL 로 해제 (부모만 지우고 자식은 보존)
  await db.from("projects").update({ parent_bolt_id: null }).eq("parent_bolt_id", id);

  // 5) 본체 삭제
  const { error: delErr } = await db.from("projects").delete().eq("id", id);
  if (delErr) {
    console.error("[delete project] final", delErr);
    return NextResponse.json(
      { error: delErr.message, cleanup, hint: "service_role 로도 실패 — DB 로그 확인" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, title: project.title, cleanup });
}
