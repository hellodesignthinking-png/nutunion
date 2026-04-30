import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateTextForUser } from "@/lib/ai/vault";
import { checkInstallationMembership } from "@/lib/threads/membership";
import { log } from "@/lib/observability/logger";

type Action = "summarize" | "extract_actions" | "recommend" | "freeform" | "cross_thread_alert";

const SYSTEM_PROMPT = `You are an assistant for a single nut (community group) or bolt (project).
You ONLY answer based on the provided context — do NOT invent facts about members, posts, or milestones that aren't in the context.
You NEVER auto-execute any action: only describe what could be done. Always output Korean.
Be concise. Use bullet points where helpful.`;

const ACTION_PROMPTS: Record<Action, string> = {
  summarize: "이 컨텍스트를 바탕으로 모든 Thread 의 최근 7일 활동을 종합 요약하세요. 각 Thread 별 1-2줄, 마지막에 전체 인사이트 1줄.",
  extract_actions: "이 컨텍스트(특히 게시판·회의록·마일스톤)에서 후속 조치(액션 아이템)를 추출하세요. 각 항목은 [누가] [언제까지] [무엇을] 형식.",
  recommend: "이 컨텍스트를 보고 다음에 하면 좋을 일 3가지를 우선순위 순으로 제안하세요.",
  cross_thread_alert: "이 컨텍스트에서 ⚠ 마일스톤 지연, 💸 예산 초과, 📉 KPI 하락 트렌드 등 이상 신호를 감지하세요. 신호가 없다면 '문제 없음'이라고 답하세요.",
  freeform: "",
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad_json" }, { status: 400 });

  const { installation_id, action, message } = body as {
    installation_id?: string; action?: Action; message?: string;
  };
  if (!installation_id || !action) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Honor user AI preferences
  const { data: prof } = await supabase.from("profiles").select("ai_preferences").eq("id", user.id).maybeSingle();
  const prefs = (prof?.ai_preferences as any) || { enabled: true, features: [] };
  if (prefs.enabled === false) {
    return NextResponse.json({ error: "ai_disabled", reply: "사용자가 AI 기능을 비활성화했습니다." }, { status: 403 });
  }
  const featureMap: Record<Action, string> = {
    summarize: "summarize",
    extract_actions: "extract_actions",
    recommend: "recommend",
    cross_thread_alert: "cross_thread_alert",
    freeform: "summarize",
  };
  const requiredFeature = featureMap[action];
  if (Array.isArray(prefs.features) && prefs.features.length > 0 && !prefs.features.includes(requiredFeature)) {
    return NextResponse.json({ error: "feature_disabled", reply: `${requiredFeature} 기능이 비활성화되어 있습니다.` }, { status: 403 });
  }

  // Membership gate — caller must belong to the target nut/bolt before we gather sibling
  // Threads' data into the AI prompt. Without this, anyone who knows an installation_id can
  // exfiltrate the last 7 days of every Thread on that nut/bolt through the LLM context.
  const m = await checkInstallationMembership(supabase, installation_id, user.id);
  if (!m.ok) {
    if (m.status === 403) {
      log.warn("threads.copilot.forbidden", { user_id: user.id, installation_id, action });
    }
    return NextResponse.json({ error: m.error }, { status: m.status });
  }
  const inst = m.installation;

  // Gather context: sibling installations + recent thread_data
  const { data: siblings } = await supabase
    .from("thread_installations")
    .select(`id, config, thread:threads ( slug, name )`)
    .eq("target_type", inst.target_type)
    .eq("target_id", inst.target_id);

  const siblingIds = (siblings || []).map((s: any) => s.id).filter((id) => id !== inst.id);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentData } = siblingIds.length
    ? await supabase
        .from("thread_data")
        .select("installation_id, data, created_at")
        .in("installation_id", siblingIds)
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(60)
    : { data: [] as any[] };

  // Target meta
  let targetMeta: any = null;
  if (inst.target_type === "nut") {
    const { data: g } = await supabase
      .from("groups")
      .select("id, name, description, created_at")
      .eq("id", inst.target_id)
      .maybeSingle();
    targetMeta = g;
  } else {
    const { data: p } = await supabase
      .from("projects")
      .select("id, title, description, created_at")
      .eq("id", inst.target_id)
      .maybeSingle();
    targetMeta = p ? { ...p, name: (p as any).title } : null;
  }

  // Build context string
  const slugBy: Record<string, string> = {};
  for (const s of (siblings || []) as any[]) slugBy[s.id] = s.thread?.slug || "unknown";

  const contextLines: string[] = [];
  contextLines.push(`# Target: ${inst.target_type}`);
  if (targetMeta) {
    contextLines.push(`- name: ${targetMeta.name}`);
    if (targetMeta.description) contextLines.push(`- description: ${targetMeta.description}`);
  }
  contextLines.push(`# Installed Threads: ${(siblings || []).map((s: any) => s.thread?.slug).filter(Boolean).join(", ") || "(none)"}`);
  contextLines.push("# Recent thread_data (newest first):");
  for (const r of (recentData || []) as any[]) {
    const slug = slugBy[r.installation_id] || "?";
    let snippet = "";
    try { snippet = JSON.stringify(r.data).slice(0, 300); } catch { snippet = String(r.data).slice(0, 300); }
    contextLines.push(`- [${slug}] ${r.created_at}: ${snippet}`);
  }

  const userPrompt = action === "freeform" ? (message || "") : ACTION_PROMPTS[action];
  if (!userPrompt) return NextResponse.json({ error: "empty_message" }, { status: 400 });

  const fullPrompt = `${userPrompt}\n\n--- CONTEXT ---\n${contextLines.join("\n")}\n--- /CONTEXT ---`;

  try {
    const result = await generateTextForUser(user.id, {
      system: SYSTEM_PROMPT,
      prompt: fullPrompt,
      tier: "fast",
      maxOutputTokens: 800,
    });

    const quickFacts: string[] = [];
    quickFacts.push(`설치된 Thread ${(siblings || []).length}개`);
    quickFacts.push(`최근 데이터 ${(recentData || []).length}건 참고`);

    // Best-effort: log action for dependency awareness (skip on missing table)
    try {
      await supabase.from("user_ai_actions").insert({
        user_id: user.id,
        action_type: `copilot_${action}`,
        payload: { installation_id, target_type: inst.target_type, target_id: inst.target_id },
        outcome: "pending",
      });
    } catch { /* migration 121 may be missing */ }

    return NextResponse.json({
      reply: result.text,
      model_used: result.model_used,
      reasoning: `이 답변은 ${(siblings || []).length}개 Thread 의 최근 7일 ${(recentData || []).length}건의 데이터를 컨텍스트로 사용했습니다. 모델: ${result.model_used}. 사용된 Thread: ${(siblings || []).map((s: any) => s.thread?.slug).filter(Boolean).join(", ")}.`,
      quick_facts: quickFacts,
      requires_confirm: action !== "freeform" && action !== "summarize" && action !== "cross_thread_alert",
    });
  } catch (e: any) {
    log.error(e, "threads.copilot.ai_failed", { user_id: user.id, installation_id, action });
    return NextResponse.json({ error: `ai_failed: ${e?.message || e}` }, { status: 500 });
  }
}
