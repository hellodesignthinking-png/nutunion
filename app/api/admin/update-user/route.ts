import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/observability/logger";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // ── 1. 세션 인증 ────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── 2. 호출자 admin 확인 ─────────────────────────────────────────
    const { data: caller } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (caller?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
    }

    // ── 3. 요청 파싱 ─────────────────────────────────────────────────
    const body = await req.json();
    const { userId, grade, role, can_create_crew, can_create_project } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    // ── 4. 업데이트 클라이언트 선택 (Service Role Key 우선) ──────────
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

    const updateClient: any = serviceKey
      ? createAdminClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : supabase;

    // ── 5. 단일 쿼리로 모든 필드 업데이트 ───────────────────────────
    const updatePayload: Record<string, any> = {
      role: role || "member",
      can_create_crew: !!can_create_crew,
    };

    // grade 컬럼은 DB에 없을 수 있으므로 시도 후 안전하게 처리
    const { error: updateError } = await updateClient
      .from("profiles")
      .update({
        ...updatePayload,
        grade: grade || null,
        can_create_project: !!can_create_project,
      })
      .eq("id", userId);

    // grade 컬럼 없는 경우 fallback (column not found 에러 처리)
    if (updateError) {
      const isColumnError =
        updateError.message?.includes("grade") ||
        updateError.message?.includes("can_create_project") ||
        updateError.code === "PGRST204" ||
        updateError.code === "42703";

      if (isColumnError) {
        // grade 없는 구버전 스키마 — role + can_create_crew만 업데이트
        const { error: fallbackError } = await updateClient
          .from("profiles")
          .update(updatePayload)
          .eq("id", userId);

        if (fallbackError) {
          return NextResponse.json(
            { error: "update failed: " + fallbackError.message },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          gradeSaved: false,
          gradeError: "grade 컬럼이 없습니다. SQL 마이그레이션을 먼저 실행하세요.",
                  });
      }

      return NextResponse.json(
        { error: "update failed: " + updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      gradeSaved: true,
      gradeError: null,
          });

  } catch (e: any) {
    log.error(e, "admin.update-user.failed");
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
