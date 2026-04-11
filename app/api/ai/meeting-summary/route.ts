import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `당신은 NutUnion 플랫폼의 AI 회의록 정리 어시스턴트입니다.
사용자가 제공하는 회의 내용(텍스트 메모 또는 녹음 내용)을 분석하여 구조화된 회의록을 생성합니다.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요:

{
  "summary": "회의 전체를 2-3문장으로 요약",
  "discussions": ["논의된 주요 사항 목록"],
  "decisions": ["결정된 사항 목록 (없으면 빈 배열)"],
  "actionItems": [{"task": "할 일", "assignee": "담당자 (언급된 경우, 없으면 null)"}],
  "nextTopics": ["다음 미팅에서 다룰 주제 제안 2-3개"]
}

규칙:
- 반드시 유효한 JSON만 출력
- 한국어로 작성
- 논의사항은 핵심만 간결하게
- 액션아이템은 구체적으로 (누가 무엇을 언제까지)
- 다음 미팅 주제는 이번 회의 맥락에서 자연스럽게 이어지는 것으로 제안
- 내용이 부족하면 있는 만큼만 정리하고, 없는 항목은 빈 배열로`;

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY가 설정되지 않았습니다. Vercel 환경변수에 GEMINI_API_KEY를 추가해주세요." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { notes, agendas, meetingTitle, audioBase64, audioMimeType, previousDigest } = body;

    if (!notes && !audioBase64) {
      return NextResponse.json(
        { error: "회의 내용 또는 녹음 파일이 필요합니다" },
        { status: 400 }
      );
    }

    // Build the prompt
    let userPrompt = `## 회의 정보\n- 제목: ${meetingTitle || "미팅"}\n`;

    // Inject previous digest context (token-saving: compressed context from last week)
    if (previousDigest) {
      userPrompt += `\n## 📌 이전 주간 다이제스트 (이 맥락을 기반으로 이어서 분석하세요)\n${previousDigest}\n`;
    }

    if (agendas && agendas.length > 0) {
      userPrompt += `- 안건: ${agendas.map((a: any) => a.topic).join(", ")}\n`;
    }

    if (notes) {
      userPrompt += `\n## 회의 내용 (텍스트 기록)\n${notes}\n`;
    }

    if (audioBase64) {
      userPrompt += `\n## 녹음 파일이 첨부되었습니다. 녹음 내용을 분석하여 회의록을 작성해주세요.\n`;
    }

    userPrompt += `\n위 내용을 분석하여 JSON 형식의 회의록을 생성해주세요.`;
    if (previousDigest) {
      userPrompt += `\n이전 주간 다이제스트의 맥락을 참고하여 연속성 있게 작성하세요. 이미 결정된 사항은 반복하지 마세요.`;
    }

    // Build Gemini API request
    const parts: any[] = [];

    // System instruction as first text part
    parts.push({ text: SYSTEM_PROMPT });

    // Audio file (if provided)
    if (audioBase64 && audioMimeType) {
      parts.push({
        inlineData: {
          mimeType: audioMimeType,
          data: audioBase64,
        },
      });
    }

    // User prompt
    parts.push({ text: userPrompt });

    const geminiBody = {
      contents: [
        {
          parts,
        },
      ],
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    };

    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      return NextResponse.json(
        { error: `Gemini API 오류 (${response.status})` },
        { status: 502 }
      );
    }

    const data = await response.json();

    // Extract the text from Gemini response
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON from response
    let result;
    try {
      // Try direct parse first
      result = JSON.parse(text);
    } catch {
      // Try extracting JSON from markdown code block
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1].trim());
      } else {
        // Last resort: find first { ... } block
        const braceMatch = text.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          result = JSON.parse(braceMatch[0]);
        } else {
          throw new Error("AI 응답에서 JSON을 파싱할 수 없습니다");
        }
      }
    }

    // Validate and normalize the result structure
    const normalized = {
      summary: result.summary || "회의 요약을 생성할 수 없습니다.",
      discussions: Array.isArray(result.discussions) ? result.discussions : [],
      decisions: Array.isArray(result.decisions) ? result.decisions : [],
      actionItems: Array.isArray(result.actionItems)
        ? result.actionItems.map((item: any) => ({
            task: item.task || item.content || "",
            assignee: item.assignee || null,
          }))
        : [],
      nextTopics: Array.isArray(result.nextTopics) ? result.nextTopics : [],
    };

    return NextResponse.json(normalized);
  } catch (error: any) {
    console.error("Meeting summary error:", error);
    return NextResponse.json(
      { error: error.message || "회의록 생성 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
