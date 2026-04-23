import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

import { aiError } from "@/lib/ai/error";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_HEADERS = { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY ?? "" };

// POST: Generate AI summary for a single resource
export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY 미설정" }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const { success } = rateLimit(`ai:${user.id}`, 20, 60_000);
  if (!success) {
    return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const { resourceId } = await request.json();
  if (!resourceId) return NextResponse.json({ error: "resourceId 필요" }, { status: 400 });

  let resource: any = null;
  let resourceSource: "weekly" | "file_attachment" = "weekly";
  try {
    const { data } = await supabase
      .from("wiki_weekly_resources")
      .select("id, title, url, resource_type, description")
      .eq("id", resourceId)
      .single();
    resource = data;
  } catch {
    // Table may not exist if migration 028 not run
  }

  // Fallback: check file_attachments if not found in wiki_weekly_resources
  if (!resource) {
    try {
      const { data: faData } = await supabase
        .from("file_attachments")
        .select("id, file_name, file_url, file_type")
        .eq("id", resourceId)
        .single();
      if (faData) {
        resource = {
          id: faData.id,
          title: faData.file_name,
          url: faData.file_url,
          resource_type: faData.file_type || "other",
          description: null,
        };
        resourceSource = "file_attachment";
      }
    } catch {
      // Table may not exist
    }
  }

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
      headers: GEMINI_HEADERS,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
      }),
    });

    if (!res.ok) {
      return aiError("ai_unavailable", "ai/resource-summary");
    }

    const data = await res.json();
    const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (summary) {
      if (resourceSource === "weekly") {
        await supabase
          .from("wiki_weekly_resources")
          .update({ auto_summary: summary })
          .eq("id", resourceId);
      }
      // file_attachments doesn't have auto_summary column — skip persistence
    }

    return NextResponse.json({ summary });
  } catch (e: unknown) {
    return aiError("server_error", "ai/resource-summary", { internal: e });
  }
}
