import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";
import { askClaude } from "@/lib/ai/client";

export const maxDuration = 30;

/**
 * POST /api/ai/profile-enhance
 * → 참여 볼트 히스토리 + 탭 작성 기반으로 스킬 태그 10개 + 한 줄 소개 3버전 제안.
 */

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 맥락 수집 — 참여 볼트 제목/카테고리 + 작성한 탭 제목
  const [{ data: members }, { data: profile }] = await Promise.all([
    supabase
      .from("project_members")
      .select("role, project:projects(title, category)")
      .eq("user_id", user.id)
      .limit(10),
    supabase
      .from("profiles")
      .select("nickname, bio, specialty, skill_tags")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const bolts = (members ?? [])
    .map((m: any) => Array.isArray(m.project) ? m.project[0] : m.project)
    .filter(Boolean)
    .map((p: any) => `- ${p.title} (${p.category})`)
    .join("\n") || "아직 참여 볼트 없음";

  const prompt = `다음 와셔의 참여 맥락을 읽고, 스킬 태그 10개 + 한 줄 소개 3버전 (진지/유쾌/전문가) 을 제안해주세요.

## 와셔 정보
닉네임: ${profile?.nickname ?? "—"}
전문분야: ${profile?.specialty ?? "—"}
기존 자기소개: ${profile?.bio ?? "—"}
기존 스킬 태그: ${(profile?.skill_tags ?? []).join(", ") || "—"}

## 참여 볼트
${bolts}

반드시 JSON 으로만 응답:
{
  "skills": ["태그1","태그2", ...],
  "slogans": {
    "serious": "진지한 톤 한 줄",
    "playful": "유쾌한 톤 한 줄",
    "expert":  "전문가 톤 한 줄"
  }
}

스킬은 한글·영문 혼용 허용, 60자 이내 슬로건.`;

  const result = await askClaude({
    userId: user.id,
    feature: "profile_enhance",
    maxTokens: 900,
    user: prompt,
  });
  if (!result.text) return NextResponse.json({ error: result.error, stubbed: result.stubbed }, { status: 500 });

  try {
    const jsonText = result.text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    return NextResponse.json({ enhancement: JSON.parse(jsonText) });
  } catch {
    return NextResponse.json({ enhancement: null, raw: result.text });
  }
}
