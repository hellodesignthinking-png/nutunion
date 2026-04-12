import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// POST: Generate AI summary for a single resource
export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY 미설정" }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const { resourceId } = await request.json();
  if (!resourceId) return NextResponse.json({ error: "resourceId 필요" }, { status: 400 });

  const { data: resource } = await supabase
    .from("wiki_weekly_resources")
    .select("id, title, url, resource_type, description")
    .eq("id", resourceId)
    .single();

  if (!resource) return NextResponse.json({ error: "리소스를 찾을 수 없습니다" }, { status: 404 });

  // Already has summary
  if (resource.description && resource.description.length > 100) {
    return NextResponse.json({ summary: resource.description });
  }

  const prompt = `다음 리소스를 한국어로 2~3문장으로 요약해주세요. 핵심 주제와 배울 수 있는 내용을 포함하세요.

제목: ${resource.title}
URL: ${resource.url}
유형: ${resource.resource_type}
${resource.description ? `설명: ${resource.description}` : ""}

반드시 요약 텍스트만 출력하세요 (JSON이나 마크다운 없이).`;

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "AI 요약 생성 실패" }, { status: 502 });
    }

    const data = await res.json();
    const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (summary) {
      await supabase
        .from("wiki_weekly_resources")
        .update({ auto_summary: summary })
        .eq("id", resourceId);
    }

    return NextResponse.json({ summary });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "요약 생성 실패" }, { status: 500 });
  }
}
