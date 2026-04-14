import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `당신은 NutUnion 플랫폼의 AI 지식 추출 어시스턴트입니다.
사용자가 제공하는 회의 내용에서 탭에 반영할 핵심 지식을 추출합니다.

반드시 아래 JSON 형식으로만 응답하세요:

{
  "entities": [{"name": "핵심 개념/키워드", "isNew": true}],
  "decisions": ["확정된 결정 사항"],
  "openQuestions": ["아직 해결되지 않은 질문이나 과제"],
  "wikiUpdates": [{"pageTitle": "탭 페이지 제목", "suggestion": "이 페이지에 추가할 내용 설명", "action": "create 또는 update"}],
  "suggestedTags": ["관련 태그"]
}

규칙:
- 반드시 유효한 JSON만 출력
- 한국어로 작성
- entities는 회의에서 반복적으로 언급되거나 중요한 개념/키워드
- decisions는 [결정], [합의], ~하기로 등의 표현이 포함된 문장
- openQuestions은 미해결 질문이나 앞으로 논의할 사항
- wikiUpdates는 새로 만들 탭 문서(create) 또는 기존 문서 업데이트 제안(update)
- suggestedTags는 이 미팅 내용과 관련된 분류 태그
- 내용이 부족하면 있는 만큼만 정리`;

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    const { success } = rateLimit(`ai:${user.id}`, 20, 60_000);
    if (!success) {
      return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
    }

    const body = await request.json();
    const { meetingContent, existingTopics, existingPages } = body;

    if (!meetingContent?.trim()) {
      return NextResponse.json(
        { error: "분석할 미팅 내용이 필요합니다" },
        { status: 400 }
      );
    }

    let userPrompt = `## 미팅 내용\n${meetingContent}\n`;

    if (existingTopics?.length > 0) {
      userPrompt += `\n## 기존 탭 토픽\n${existingTopics.join(", ")}\n`;
    }
    if (existingPages?.length > 0) {
      userPrompt += `\n## 기존 탭 페이지\n${existingPages.join(", ")}\n`;
    }

    userPrompt += `\n위 미팅 내용을 분석하여 탭에 반영할 핵심 지식을 JSON 형식으로 추출해주세요.`;
    userPrompt += `\n기존 탭 토픽/페이지와 겹치는 개념은 isNew: false로, 새로운 개념은 isNew: true로 표시하세요.`;
    userPrompt += `\n기존 페이지와 관련된 내용이 있으면 wikiUpdates에 action: "update"로 추가하세요.`;

    const geminiBody = {
      contents: [
        {
          parts: [
            { text: SYSTEM_PROMPT },
            { text: userPrompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    };

    // Retry logic with exponential backoff
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
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
          continue;
        }
        break;
      } catch (fetchErr: any) {
        lastError = fetchErr.message || "Network error";
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }

    if (!response || !response.ok) {
      const errorText = response ? await response.text() : lastError;
      console.error("Gemini API error after retries:", errorText);
      return NextResponse.json(
        { error: `Gemini API 오류: ${lastError}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1].trim());
      } else {
        const braceMatch = text.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          result = JSON.parse(braceMatch[0]);
        } else {
          throw new Error("AI 응답에서 JSON을 파싱할 수 없습니다");
        }
      }
    }

    // Normalize
    const normalized = {
      entities: Array.isArray(result.entities)
        ? result.entities.map((e: any) => ({ name: e.name || "", isNew: e.isNew ?? true }))
        : [],
      decisions: Array.isArray(result.decisions) ? result.decisions : [],
      openQuestions: Array.isArray(result.openQuestions) ? result.openQuestions : [],
      wikiUpdates: Array.isArray(result.wikiUpdates)
        ? result.wikiUpdates.map((u: any) => ({
            pageTitle: u.pageTitle || "",
            suggestion: u.suggestion || "",
            action: u.action === "update" ? "update" : "create",
          }))
        : [],
      suggestedTags: Array.isArray(result.suggestedTags) ? result.suggestedTags : [],
    };

    return NextResponse.json(normalized);
  } catch (error: any) {
    console.error("Wiki extract error:", error);
    return NextResponse.json(
      { error: error.message || "탭 추출 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
