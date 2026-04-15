import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, { status: 500 });
  }

  try {
    const { groupId, question } = await request.json();
    if (!groupId || !question) {
      return NextResponse.json({ error: "groupId와 question이 필요합니다." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    // Verify membership
    const { data: member } = await supabase
      .from("group_members")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ error: "이 그룹의 멤버만 이용할 수 있습니다." }, { status: 403 });
    }

    // Gather wiki context
    const { data: topics } = await supabase
      .from("wiki_topics")
      .select("id, name, description")
      .eq("group_id", groupId);

    const topicIds = (topics || []).map(t => t.id);
    let pagesContext = "";

    if (topicIds.length > 0) {
      const { data: pages } = await supabase
        .from("wiki_pages")
        .select("title, content, topic_id")
        .in("topic_id", topicIds)
        .order("updated_at", { ascending: false })
        .limit(15);

      if (pages && pages.length > 0) {
        const topicMap = Object.fromEntries((topics || []).map(t => [t.id, t.name]));
        pagesContext = pages.map(p => {
          const topicName = topicMap[p.topic_id] || "기타";
          // Limit each page to ~500 chars to save tokens
          const truncated = p.content.length > 500
            ? p.content.slice(0, 500) + "..."
            : p.content;
          return `[섹션: ${topicName}] ${p.title}\n${truncated}`;
        }).join("\n\n---\n\n");
      }
    }

    // Also get recent meeting summaries
    const { data: meetings } = await supabase
      .from("meetings")
      .select("title, summary, scheduled_at")
      .eq("group_id", groupId)
      .eq("status", "completed")
      .order("scheduled_at", { ascending: false })
      .limit(5);

    let meetingContext = "";
    if (meetings && meetings.length > 0) {
      meetingContext = meetings.map(m => {
        const date = new Date(m.scheduled_at).toLocaleDateString("ko");
        return `[${date} 회의: ${m.title}]\n${(m.summary || "요약 없음").slice(0, 300)}`;
      }).join("\n\n");
    }

    // Get group info
    const { data: group } = await supabase
      .from("groups")
      .select("name, description")
      .eq("id", groupId)
      .single();

    const systemPrompt = `당신은 "${group?.name || "이 너트"}"의 위키 지식 비서입니다.
아래 위키 내용과 최근 회의 기록을 바탕으로 사용자의 질문에 정확하고 간결하게 답변하세요.

규칙:
- 위키에 있는 정보만 사용하세요. 추측하지 마세요.
- 위키에 관련 정보가 없으면 "아직 위키에 해당 내용이 정리되어 있지 않습니다"라고 답하세요.
- 답변은 한국어로, 200자 이내로 간결하게 작성하세요.
- 관련 섹션 이름을 언급해주면 사용자가 직접 찾아볼 수 있습니다.

그룹 소개: ${group?.description || "정보 없음"}

--- 위키 내용 ---
${pagesContext || "아직 위키 내용이 없습니다."}

--- 최근 회의 ---
${meetingContext || "기록된 회의가 없습니다."}`;

    // Call Gemini
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: question }] }],
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.3,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => "");
      return NextResponse.json(
        { error: `AI 응답 오류 (${geminiRes.status}): ${errText.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const data = await geminiRes.json();

    if (data?.promptFeedback?.blockReason) {
      return NextResponse.json(
        { error: `AI가 요청을 차단했습니다: ${data.promptFeedback.blockReason}` },
        { status: 502 }
      );
    }

    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text || "답변을 생성할 수 없습니다.";

    return NextResponse.json({ answer });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "서버 오류" }, { status: 500 });
  }
}
