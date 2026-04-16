import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `당신은 NutUnion 커뮤니티 플랫폼의 AI 기획 어시스턴트입니다.
사용자가 만들려는 소모임(너트)의 이름과 소개를 바탕으로 운영 계획을 제안합니다.

반드시 아래 JSON 형식으로만 응답하세요:

{
  "wikiTopics": [
    {"name": "탭 이름", "description": "이 탭에서 다룰 내용 설명", "emoji": "적절한 이모지"}
  ],
  "meetingTypes": [
    {"name": "회의 유형 이름", "frequency": "주 1회 / 격주 / 월 1회 등", "purpose": "이 회의의 목적과 진행 방식"}
  ],
  "contentPlan": "전체 운영 방향 및 콘텐츠 기획 요약 (2-3문장)",
  "suggestedTags": ["태그1", "태그2", "태그3"]
}

규칙:
- 반드시 유효한 JSON만 출력
- 한국어로 작성
- wikiTopics: 3-5개 제안 (이 소모임에 필요한 지식 문서 탭)
- meetingTypes: 2-3개 제안 (정기 회의 유형)
- contentPlan: 간결하고 실용적인 운영 방향
- suggestedTags: 4-6개 관련 키워드
- 소모임의 성격과 목적에 맞게 구체적으로 제안`;

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, { status: 500 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    const { success } = rateLimit(`ai:group-plan:${user.id}`, 10, 60_000);
    if (!success) {
      return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "소모임 이름이 필요합니다" }, { status: 400 });
    }

    const userPrompt = `## 소모임 이름\n${name}\n\n## 소개\n${description || "소개 없음"}\n\n위 소모임을 위한 운영 계획을 JSON 형식으로 제안해주세요.`;

    const geminiBody = {
      contents: [{ parts: [{ text: SYSTEM_PROMPT }, { text: userPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
      },
    };

    let response: Response | null = null;
    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await fetch(GEMINI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiBody),
        });
        if (response.ok) break;
        lastError = `HTTP ${response.status}`;
        if (response.status === 429 || response.status >= 500) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
          continue;
        }
        break;
      } catch (fetchErr: any) {
        lastError = fetchErr.message || "Network error";
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }

    if (!response || !response.ok) {
      return NextResponse.json({ error: `AI 오류: ${lastError}` }, { status: 502 });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      const braceMatch = text.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        result = JSON.parse(braceMatch[0]);
      } else {
        throw new Error("JSON 파싱 실패");
      }
    }

    const normalized = {
      wikiTopics: Array.isArray(result.wikiTopics)
        ? result.wikiTopics.slice(0, 5).map((t: any) => ({
            name: String(t.name || ""),
            description: String(t.description || ""),
            emoji: String(t.emoji || "📝"),
          }))
        : [],
      meetingTypes: Array.isArray(result.meetingTypes)
        ? result.meetingTypes.slice(0, 3).map((m: any) => ({
            name: String(m.name || ""),
            frequency: String(m.frequency || ""),
            purpose: String(m.purpose || ""),
          }))
        : [],
      contentPlan: String(result.contentPlan || ""),
      suggestedTags: Array.isArray(result.suggestedTags)
        ? result.suggestedTags.slice(0, 6).map(String)
        : [],
    };

    return NextResponse.json(normalized);
  } catch (error: any) {
    console.error("Group plan AI error:", error);
    return NextResponse.json({ error: error.message || "AI 기획 생성 중 오류" }, { status: 500 });
  }
}
