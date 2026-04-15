import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

// POST: 새 의뢰 제출
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Authentication required
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    // Rate limit: 5 requests per 60 seconds per user
    const { success: rateLimitOk } = rateLimit(`challenge-post:${user.id}`, 5, 60_000);
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429 }
      );
    }

    const body = await request.json();

    const {
      companyName,
      contactEmail,
      contactName,
      contactPhone,
      projectTitle,
      description,
      budget,
      timeline,
      requiredSkills,
    } = body;

    // Validation
    if (!companyName || !contactEmail || !projectTitle) {
      return NextResponse.json(
        { error: "필수 항목(회사명, 이메일, 프로젝트 제목)을 입력해주세요." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail)) {
      return NextResponse.json({ error: "올바른 이메일 형식이 아닙니다" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("challenge_proposals")
      .insert({
        company_name: companyName,
        contact_email: contactEmail,
        contact_name: contactName || null,
        contact_phone: contactPhone || null,
        project_title: projectTitle,
        description: description || null,
        budget: budget || null,
        timeline: timeline || null,
        required_skills: requiredSkills || [],
        status: "submitted",
        submitted_by: user.id,
      })
      .select("id, status, created_at")
      .single();

    if (error) {
      console.error("Challenge proposal insert error:", error);
      return NextResponse.json(
        { error: "의뢰 등록에 실패했습니다: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ proposal: data });
  } catch (err: any) {
    console.error("Challenge proposal error:", err);
    return NextResponse.json(
      { error: err.message || "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// GET: 본인 의뢰 목록 조회
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ proposals: [] });
    }

    const { data, error } = await supabase
      .from("challenge_proposals")
      .select("id, project_title, status, created_at, reviewed_at, company_name")
      .eq("submitted_by", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ proposals: [] });
    }

    return NextResponse.json({ proposals: data || [] });
  } catch {
    return NextResponse.json({ proposals: [] });
  }
}
