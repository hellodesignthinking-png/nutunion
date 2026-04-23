import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { askClaude } from "@/lib/ai/client";

export const maxDuration = 30;

/**
 * POST /api/ai/match-explain
 * Body: { targetType: 'nut'|'bolt', targetId, baseReason?: string }
 * → 규칙 기반 추천 이유를 자연스러운 한 문장으로 재작성.
 */

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { targetType, targetId, baseReason } = await req.json();
  if (!targetType || !targetId) return NextResponse.json({ error: "targetType/targetId required" }, { status: 400 });

  // 양쪽 맥락 수집
  const [{ data: profile }, target] = await Promise.all([
    supabase.from("profiles").select("nickname, specialty, skill_tags, bio").eq("id", user.id).maybeSingle(),
    targetType === "nut"
      ? supabase.from("groups").select("name, description, category").eq("id", targetId).maybeSingle()
      : supabase.from("projects").select("title, description, category").eq("id", targetId).maybeSingle(),
  ]);

  const t: any = target.data;
  const title = t?.name ?? t?.title ?? "대상";
  const desc = t?.description?.slice(0, 200) ?? "";

  const prompt = `와셔에게 ${targetType === "nut" ? "너트" : "볼트"} 추천 이유를 한 문장으로 자연스럽게 설명해주세요.
"스킬 매칭 3개" 같은 기계적 표현 금지. 왜 적합한지 맥락 기반으로.

와셔: ${profile?.nickname ?? "—"} · ${profile?.specialty ?? "—"} · 스킬 ${(profile?.skill_tags ?? []).slice(0, 5).join(", ") || "—"}
대상(${targetType}): ${title} · 분야 ${t?.category ?? "—"}
대상 설명: ${desc}
규칙 기반 이유: ${baseReason ?? "—"}

출력: 한 문장 한국어 (60자 이내). 따옴표 없이.`;

  const result = await askClaude({
    userId: user.id,
    feature: "match_explain",
    maxTokens: 160,
    user: prompt,
  });
  if (!result.text) {
    // AI 실패 — 프론트 UI 깨뜨리지 않도록 200 + 빈 explanation
    return NextResponse.json({ explanation: "", error: result.error, stubbed: result.stubbed });
  }
  return NextResponse.json({ explanation: result.text.trim().replace(/^["']|["']$/g, "") });
}
