import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateObjectForUser } from "@/lib/ai/vault";
import { extractContent } from "@/lib/wiki/content-extractor";
import { z } from "zod";

// Synthesis can hit pdf-parse / Google export / HTML scrape — give it room.
export const maxDuration = 120;
const TOTAL_PROMPT_CHAR_BUDGET = 50_000;

// GET: List synthesis logs for a group
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");
  const limit = parseInt(searchParams.get("limit") || "10");

  if (!groupId) {
    return NextResponse.json({ error: "groupId 필요" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  // Verify requester is a member of the group
  const { data: membership } = await supabase
    .from("group_members")
    .select("status")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: groupRow } = await supabase
    .from("groups")
    .select("host_id")
    .eq("id", groupId)
    .single();

  const isHost = groupRow?.host_id === user.id;
  const isMember = membership?.status === "active";

  if (!isHost && !isMember) {
    return NextResponse.json({ error: "그룹 멤버만 접근할 수 있습니다" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("wiki_synthesis_logs")
    .select("id, week_start, week_end, synthesis_type, input_summary, output_data, created_at, creator:profiles!wiki_synthesis_logs_created_by_fkey(nickname)")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const logs = (data || []).map((log: any) => ({
    id: log.id,
    weekStart: log.week_start,
    weekEnd: log.week_end,
    type: log.synthesis_type,
    inputSummary: log.input_summary,
    theme: log.output_data?.weeklyTheme || null,
    pagesCreated: log.output_data?.wikiPageSuggestions?.length || 0,
    compactionNote: log.output_data?.compactionNote || null,
    createdBy: log.creator?.nickname || "Unknown",
    createdAt: log.created_at,
  }));

  return NextResponse.json({ logs });
}

// POST: Topic-rewrite synthesis flow (NEW behavior — replaces append-flow).
// Body: { topic_id: string, resource_ids: string[], preview?: boolean }
//   preview=true → returns AI proposal but does not commit.
//   preview=false (or omitted) → snapshots current content, overwrites with AI result, bumps version.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  let body: { topic_id?: string; resource_ids?: string[]; preview?: boolean } = {};
  try { body = await request.json(); } catch { /* fallthrough */ }
  const topicId = body.topic_id;
  const resourceIds = Array.isArray(body.resource_ids) ? body.resource_ids : [];
  const preview = body.preview === true;

  if (!topicId) {
    return NextResponse.json({ error: "topic_id 필요" }, { status: 400 });
  }

  // Load topic + group + permission
  const { data: topic, error: topicErr } = await supabase
    .from("wiki_topics")
    .select("id, group_id, name, description, content, current_version")
    .eq("id", topicId)
    .single();
  if (topicErr || !topic) return NextResponse.json({ error: "주제를 찾을 수 없습니다" }, { status: 404 });

  const { data: groupRow } = await supabase
    .from("groups")
    .select("host_id, name")
    .eq("id", topic.group_id)
    .single();
  const { data: membership } = await supabase
    .from("group_members")
    .select("status")
    .eq("group_id", topic.group_id)
    .eq("user_id", user.id)
    .maybeSingle();
  const isHost = groupRow?.host_id === user.id;
  const isMember = membership?.status === "active";
  if (!isHost && !isMember) {
    return NextResponse.json({ error: "그룹 멤버만 통합 실행 가능" }, { status: 403 });
  }

  // Load selected resources
  let resources: { id: string; title: string; url: string | null; resource_type: string | null; auto_summary: string | null; description: string | null }[] = [];
  if (resourceIds.length > 0) {
    const { data: resData } = await supabase
      .from("wiki_weekly_resources")
      .select("id, title, url, resource_type, auto_summary, description, group_id")
      .in("id", resourceIds)
      .eq("group_id", topic.group_id);
    resources = (resData || []).map(r => ({
      id: r.id,
      title: r.title,
      url: r.url,
      resource_type: r.resource_type,
      auto_summary: r.auto_summary,
      description: r.description,
    }));
  }

  // ── Extract real content per resource (NEW — was metadata-only before) ──
  // Each resource is fetched in parallel; failures fall back to auto_summary/description.
  type ExtractStat = {
    id: string;
    title: string;
    type: string;
    method: string;            // "transcript" | "scrape" | "drive_export" | "pdf_parse" | "metadata" | "fallback"
    word_count: number;
    truncated: boolean;
    fallback_reason?: string;  // present when we fell back to metadata
  };
  const extractStats: ExtractStat[] = [];

  const extractedBlocks = resources.length === 0
    ? []
    : await Promise.all(resources.map(async (r, i) => {
        const head = `### [자료 ${i + 1}] ${r.title}\n출처: ${r.url || "(없음)"}\n유형: ${r.resource_type || "link"}`;
        const meta = (r.auto_summary || r.description || "").trim();

        const result = await extractContent(
          { id: r.id, title: r.title, url: r.url, resource_type: r.resource_type, auto_summary: r.auto_summary, description: r.description },
          user.id,
        );

        if (result.ok) {
          extractStats.push({
            id: r.id,
            title: r.title,
            type: r.resource_type || "link",
            method: result.method,
            word_count: result.word_count,
            truncated: result.truncated,
          });
          return `${head}\n[추출 방식: ${result.method}${result.truncated ? " · 일부 생략" : ""}]\n\n${result.content}`;
        }

        // Fallback to metadata
        extractStats.push({
          id: r.id,
          title: r.title,
          type: r.resource_type || "link",
          method: "fallback",
          word_count: 0,
          truncated: false,
          fallback_reason: result.reason,
        });
        const fallbackBody = meta || "(요약 없음 — 콘텐츠 추출 실패)";
        return `${head}\n[추출 실패: ${result.reason} — 메타데이터만 사용]\n\n${fallbackBody.slice(0, 800)}`;
      }));

  // Apply total budget — earlier resources keep priority, later ones are trimmed if over budget.
  let runningChars = 0;
  const trimmedBlocks: string[] = [];
  for (const block of extractedBlocks) {
    if (runningChars + block.length > TOTAL_PROMPT_CHAR_BUDGET) {
      const remain = TOTAL_PROMPT_CHAR_BUDGET - runningChars;
      if (remain > 500) trimmedBlocks.push(block.slice(0, remain) + "\n…(통합 예산 초과로 절단)");
      break;
    }
    trimmedBlocks.push(block);
    runningChars += block.length;
  }

  // Build AI input
  const existing = (topic.content || "").trim();
  const resourceBlock = trimmedBlocks.length > 0
    ? trimmedBlocks.join("\n\n---\n\n")
    : "(이번 통합에 추가된 자료 없음 — 기존 콘텐츠 자체를 다듬어주세요.)";

  // Server-side log for observability (visible via Vercel runtime logs).
  if (resources.length > 0) {
    const summary = extractStats.map(s =>
      `${s.type}/${s.method}${s.fallback_reason ? `(${s.fallback_reason})` : ""}=${s.word_count}w${s.truncated ? "+trunc" : ""}`,
    ).join(", ");
    console.log(`[wiki-synthesis] topic=${topicId} extracted ${extractStats.length} resources: ${summary}`);
  }

  const system = `당신은 위키 콘텐츠 큐레이터입니다.
기존 탭 콘텐츠를 받아 새로운 자료들의 인사이트를 통합한 **개선된 단일 마크다운** 을 작성합니다.

원칙:
- 자료를 단순 누적하지 마세요. 개념 중심으로 재구성하고, 기존 섹션을 강화/리팩토링하세요.
- 새 자료는 인용(예: "[출처: 자료1]")으로 본문에 녹여넣되, 단순 나열이 아닌 의미 있는 문맥으로.
- 기존에 있던 중요한 내용은 보존하되, 중복/오래된 표현은 정리.
- 결과는 가독성 있는 마크다운(##, ###, 리스트, 인용문 등)으로.
- "변경 요약(change_summary)" 은 한국어 3줄 이내로 무엇이 바뀌었는지 핵심만.
- 최소 분량: new_content 는 50자 이상.`;

  const prompt = `# 탭 주제
${topic.name}
${topic.description ? `\n주제 설명: ${topic.description}\n` : ""}

# 기존 통합 콘텐츠 (현재 v${topic.current_version || 0})
${existing || "(아직 통합된 콘텐츠 없음 — 새로 작성하세요.)"}

# 새로 통합할 자료 (${resources.length}개)
${resourceBlock}

위 정보를 바탕으로 개선된 단일 마크다운(new_content)과 변경 요약(change_summary)을 만드세요.`;

  const schema = z.object({
    new_content: z.string().min(50),
    change_summary: z.string().max(500),
  });

  let aiResult: { new_content: string; change_summary: string };
  let modelLabel = "platform";
  try {
    const result = await generateObjectForUser<{ new_content: string; change_summary: string }>(
      user.id,
      schema,
      { system, prompt, tier: "fast", maxOutputTokens: 4000 },
    );
    if (!result.object) {
      throw new Error("AI 응답이 비어있습니다");
    }
    aiResult = result.object;
    modelLabel = result.model_used;
  } catch (err: any) {
    return NextResponse.json({ error: `AI 통합 실패: ${err?.message || err}` }, { status: 500 });
  }

  // Preview mode — just return without committing.
  if (preview) {
    return NextResponse.json({
      preview: true,
      new_content: aiResult.new_content,
      change_summary: aiResult.change_summary,
      model_used: modelLabel,
      previous_version: topic.current_version || 0,
      next_version: (topic.current_version || 0) + 1,
      extraction_stats: extractStats,
    });
  }

  // ── Commit flow ─────────────────────────────────────
  // 1) Snapshot current content as a version row (version = current_version, the OLD one)
  const oldVersion = topic.current_version || 0;
  const newVersion = oldVersion + 1;

  // graceful fallback: if migration 128 not applied, skip versioning
  let versioningOk = true;
  if (existing && oldVersion > 0) {
    const { error: snapErr } = await supabase.from("wiki_topic_versions").insert({
      topic_id: topicId,
      version_number: oldVersion,
      content_snapshot: existing,
      synthesis_input: null,
      synthesis_summary: "(이전 버전 자동 보존)",
      created_by: user.id,
    });
    if (snapErr) versioningOk = false;
  }

  // 2) Update wiki_topics.content to new content (graceful fallback handled by error)
  const { error: updateErr } = await supabase
    .from("wiki_topics")
    .update({
      content: aiResult.new_content,
      current_version: newVersion,
      last_synthesized_at: new Date().toISOString(),
    } as any)
    .eq("id", topicId);

  if (updateErr) {
    // If the error is column-missing (migration 128 not applied), inform caller.
    return NextResponse.json({
      error: `통합 콘텐츠 저장 실패: ${updateErr.message}. supabase/migrations/128_wiki_topic_versions.sql 적용 여부를 확인하세요.`,
    }, { status: 500 });
  }

  // 3) Insert NEW version row pointing to the just-saved content + synthesis input metadata.
  if (versioningOk) {
    await supabase.from("wiki_topic_versions").insert({
      topic_id: topicId,
      version_number: newVersion,
      content_snapshot: aiResult.new_content,
      synthesis_input: {
        resource_ids: resources.map(r => r.id),
        resource_titles: resources.map(r => r.title),
      },
      synthesis_summary: aiResult.change_summary,
      created_by: user.id,
    });
  }

  // 4) Track which resources were used (best-effort, RPC from migration 065)
  if (resources.length > 0) {
    try {
      // We need a synthesis log id — create a lightweight log row
      const today = new Date();
      const day = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const { data: logRow } = await supabase.from("wiki_synthesis_logs").insert({
        group_id: topic.group_id,
        week_start: monday.toISOString().split("T")[0],
        week_end: sunday.toISOString().split("T")[0],
        synthesis_type: "topic_rewrite",
        input_summary: { newResourceCount: resources.length, topic_id: topicId, topic_name: topic.name },
        output_data: { weeklyTheme: aiResult.change_summary, compactionNote: `v${oldVersion} → v${newVersion}` },
        created_by: user.id,
      }).select("id").single();

      if (logRow?.id) {
        await supabase.rpc("record_wiki_synthesis_inputs", {
          p_synthesis_id: logRow.id,
          p_group_id: topic.group_id,
          p_entries: resources.map(r => ({ source_type: "resource", source_id: r.id })),
        });
      }
    } catch { /* best effort */ }
  }

  return NextResponse.json({
    success: true,
    topic_id: topicId,
    previous_version: oldVersion,
    current_version: newVersion,
    new_content: aiResult.new_content,
    change_summary: aiResult.change_summary,
    model_used: modelLabel,
    versioning_ok: versioningOk,
    extraction_stats: extractStats,
  });
}
