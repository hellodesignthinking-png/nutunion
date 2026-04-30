/**
 * Action: ai_sentiment_branch
 *
 * Analyze text from trigger payload (chat message, meeting excerpt, etc.),
 * classify sentiment via user-key AI. If sentiment matches `params.notify_on`,
 * insert a notification for the group host and post a system message.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { generateObjectForUser } from "@/lib/ai/vault";
import { dispatchNotification } from "@/lib/notifications/dispatch";

type Ctx = {
  admin: SupabaseClient;
  rule: any;
  payload: any;
  params: { notify_on?: "negative" | "positive" | "neutral" };
};

const SentimentSchema = z.object({
  sentiment: z.enum(["positive", "neutral", "negative"]),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
});

export default async function aiSentimentBranch({ admin, rule, payload, params }: Ctx) {
  const text: string =
    payload?.text ||
    payload?.content ||
    payload?.message ||
    payload?.body ||
    "";
  if (!text || text.trim().length < 4) {
    return { skipped: true, reason: "no text to analyze" };
  }
  const notifyOn = params.notify_on || "negative";

  let sentiment: "positive" | "neutral" | "negative" = "neutral";
  let confidence = 0;
  let summary = "";
  try {
    const res = await generateObjectForUser<z.infer<typeof SentimentSchema>>(
      rule.owner_id,
      SentimentSchema,
      {
        tier: "fast",
        system:
          "당신은 팀 커뮤니케이션의 감정 분석가입니다. 주어진 텍스트의 톤을 positive/neutral/negative 중 하나로 분류하고, 신뢰도(0~1)와 한국어 한 문장 요약을 제공합니다.",
        prompt: text.slice(0, 2000),
        maxOutputTokens: 300,
      },
    );
    const obj = res.object;
    if (!obj) return { skipped: true, reason: "ai returned no object" };
    sentiment = obj.sentiment;
    confidence = obj.confidence;
    summary = obj.summary;
  } catch (err: any) {
    return { skipped: true, reason: "ai failed", error: err?.message || String(err) };
  }

  if (sentiment !== notifyOn) {
    return { sentiment, confidence, summary, matched: false };
  }

  // Resolve target: group host for the event's group_id, or fallback to rule owner.
  const groupId = payload?.group_id || payload?.groupId;
  let hostId: string | null = null;
  if (groupId) {
    const { data: g } = await admin
      .from("groups")
      .select("host_id")
      .eq("id", groupId)
      .maybeSingle();
    hostId = (g as any)?.host_id || null;
  }
  const notifyUser = hostId || rule.owner_id;

  await dispatchNotification({
    recipientId: notifyUser,
    eventType: "sentiment_alert",
    title: `🔍 ${notifyOn === "negative" ? "부정적" : notifyOn} 감정 감지`,
    body: summary || `자동화 룰 "${rule.name}" 이 ${sentiment} 톤을 감지했어요.`,
    metadata: {
      rule_id: rule.id,
      group_id: groupId || null,
      room_id: payload?.room_id || null,
      sentiment,
      confidence,
    },
  });

  // System chat message to the source room if we have one
  const roomId = payload?.room_id;
  if (roomId) {
    await admin.from("chat_messages").insert({
      room_id: roomId,
      sender_id: rule.owner_id,
      content: `🔍 감정 감지 (${sentiment}, ${Math.round(confidence * 100)}%): ${summary}`,
      is_system: true,
    });
  }

  return { sentiment, confidence, summary, matched: true, notified: notifyUser };
}
