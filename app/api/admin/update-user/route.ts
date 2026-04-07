import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // ── 1. 현재 로그인 유저 확인 (쿠키 기반 세션) ──────────────────
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── 2. 호출자가 admin인지 확인 ──────────────────────────────────
    const { data: caller } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (caller?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
    }

    // ── 3. 업데이트 데이터 파싱 ─────────────────────────────────────
    const body = await req.json();
    const { userId, grade, role, can_create_crew, can_create_project } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    // ── 4. Service Role Key가 있으면 우선 사용 (RLS 완전 무시) ─────
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

    let updateClient: any = supabase;
    if (serviceKey) {
      updateClient = createAdminClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }

    // ── 5. role + can_create_crew 업데이트 (항상 존재) ─────────────
    const { error: baseError } = await updateClient
      .from("profiles")
      .update({ role, can_create_crew })
      .eq("id", userId);

    if (baseError) {
      return NextResponse.json(
        { error: "base update failed: " + baseError.message },
        { status: 500 }
      );
    }

    // ── 6. grade + can_create_project 업데이트 ─────────────────────
    const { error: gradeError } = await updateClient
      .from("profiles")
      .update({ grade, can_create_project })
      .eq("id", userId);

    return NextResponse.json({
      success: true,
      gradeSaved: !gradeError,
      gradeError: gradeError?.message || null,
      usedServiceKey: !!serviceKey,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
