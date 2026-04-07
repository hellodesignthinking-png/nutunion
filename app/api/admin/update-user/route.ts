import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // 현재 로그인한 유저 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 관리자 권한 확인
    const { data: caller } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (caller?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
    }

    // 업데이트할 데이터 파싱
    const body = await req.json();
    const { userId, grade, role, can_create_crew, can_create_project } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    // ① role + can_create_crew (항상 존재하는 컬럼)
    const { error: baseError } = await supabase
      .from("profiles")
      .update({ role, can_create_crew })
      .eq("id", userId);

    if (baseError) {
      return NextResponse.json({ error: baseError.message }, { status: 500 });
    }

    // ② grade + can_create_project (마이그레이션 후 존재)
    const { error: gradeError } = await supabase
      .from("profiles")
      .update({ grade, can_create_project })
      .eq("id", userId);

    return NextResponse.json({
      success: true,
      gradeSaved: !gradeError,
      gradeError: gradeError?.message || null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
