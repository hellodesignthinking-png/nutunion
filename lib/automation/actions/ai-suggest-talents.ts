/**
 * Action: ai_suggest_talents — full version.
 *
 * 1) Load project (title + description + requested_stages)
 * 2) AI (user-key vault) extracts required_skills + matching_criteria
 * 3) Query profiles: skill_tags overlap OR specialty ILIKE any skill
 * 4) Rank by overlap count + bio relevance
 * 5) Per top-N: insert notification + upsert CRM (people) + optional chat DM
 * 6) Return matched user_ids (logged into automation_logs.action_results)
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
  params: { top_n?: number; crm_sync?: boolean; send_dm?: boolean };
};

const SkillSchema = z.object({
  required_skills: z.array(z.string()).min(3).max(8),
  matching_criteria: z.string(),
});

export default async function aiSuggestTalents({ admin, rule, payload, params }: Ctx) {
  const projectId = payload?.project_id || payload?.projectId;
  if (!projectId) return { skipped: true, reason: "no project_id" };

  const topN = Math.max(1, Math.min(20, Number(params.top_n || 5)));
  const syncCrm = params.crm_sync !== false;
  const sendDm = params.send_dm === true;

  // 1) project context
  const { data: project } = await admin
    .from("projects")
    .select("id, title, description, requested_stages")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { skipped: true, reason: "project not found" };

  const p = project as any;
  const stages = Array.isArray(p.requested_stages)
    ? p.requested_stages.join(", ")
    : p.requested_stages || "";

  // 2) AI skill extraction
  let required_skills: string[] = [];
  let matching_criteria = "";
  try {
    const ai = await generateObjectForUser<z.infer<typeof SkillSchema>>(rule.owner_id, SkillSchema, {
      tier: "fast",
      system:
        "당신은 스타트업 인재 매칭 엔지니어입니다. 프로젝트 설명을 읽고 필요한 핵심 스킬과 이상적인 인재 기준을 추출합니다.",
      prompt: `제목: ${p.title}\n설명: ${p.description || ""}\n요구 단계: ${stages}\n\n- required_skills: 3~8 개의 핵심 역량 태그 (한국어 또는 영어 소문자)\n- matching_criteria: 어떤 경력/배경의 인재가 적합한지 한국어 2~3 문장 요약`,
      maxOutputTokens: 800,
    });
    const obj = ai.object;
    if (!obj) return { skipped: true, reason: "ai returned no object" };
    required_skills = obj.required_skills.map((s: string) => s.trim().toLowerCase()).filter(Boolean);
    matching_criteria = obj.matching_criteria;
  } catch (err: any) {
    return { skipped: true, reason: "ai extraction failed", error: err?.message || String(err) };
  }

  if (required_skills.length === 0) return { skipped: true, reason: "no skills extracted" };

  // 3) candidate pool — skill_tags overlap OR specialty ILIKE
  // Supabase: array overlap uses .overlaps, but profiles.skill_tags may be text[] or jsonb.
  // Use a union: (a) overlaps skill_tags, (b) specialty ILIKE any skill.
  const orFilter = required_skills
    .slice(0, 6)
    .map((s) => `specialty.ilike.%${s.replace(/[%,]/g, "")}%`)
    .join(",");

  const { data: overlapRows } = await admin
    .from("profiles")
    .select("id, nickname, specialty, skill_tags, bio")
    .overlaps("skill_tags", required_skills)
    .neq("id", rule.owner_id)
    .limit(50);

  const { data: specialtyRows } = await admin
    .from("profiles")
    .select("id, nickname, specialty, skill_tags, bio")
    .or(orFilter)
    .neq("id", rule.owner_id)
    .limit(50);

  const pool = new Map<string, any>();
  for (const row of [...(overlapRows || []), ...(specialtyRows || [])]) {
    pool.set((row as any).id, row);
  }

  // 4) rank: overlap count (weight 3) + bio relevance (keyword hits, weight 1)
  const ranked = Array.from(pool.values())
    .map((c: any) => {
      const tags: string[] = Array.isArray(c.skill_tags)
        ? c.skill_tags.map((t: any) => String(t).toLowerCase())
        : [];
      const overlap = tags.filter((t) => required_skills.includes(t)).length;
      const bioLower = String(c.bio || "").toLowerCase();
      const specialtyLower = String(c.specialty || "").toLowerCase();
      const bioHits = required_skills.filter(
        (s) => bioLower.includes(s) || specialtyLower.includes(s),
      ).length;
      return { ...c, _score: overlap * 3 + bioHits };
    })
    .filter((c) => c._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, topN);

  // 5) notifications + CRM + optional DM
  let notified = 0;
  let crmSynced = 0;
  let dmSent = 0;
  const matched_user_ids: string[] = [];

  for (const c of ranked) {
    matched_user_ids.push(c.id);
    // notification
    try {
      await dispatchNotification({
        recipientId: c.id,
        eventType: "project_invite_suggestion",
        title: "🎯 추천 볼트가 도착했어요",
        body: `'${p.title}' 볼트에 참여하실래요? (매칭 점수 ${c._score})`,
        metadata: {
          project_id: projectId,
          rule_id: rule.id,
          required_skills,
          matching_criteria,
        },
      });
      notified++;
    } catch (notifErr) {
      console.warn("[ai-suggest-talents] dispatch failed", notifErr);
    }

    // CRM upsert (people) — owner's private address book
    if (syncCrm) {
      try {
        await admin.from("people").upsert(
          {
            owner_id: rule.owner_id,
            linked_user_id: c.id,
            name: c.nickname || "멤버",
            category: "talent",
            tags: required_skills,
            notes: `AI 매칭 — ${matching_criteria}`,
          },
          { onConflict: "owner_id,linked_user_id" },
        );
        crmSynced++;
      } catch {
        /* people table may not exist — skip silently */
      }
    }

    // chat DM (direct room with target)
    if (sendDm) {
      try {
        // find or create DM room
        const { data: dmRoom } = await admin
          .from("chat_rooms")
          .select("id")
          .eq("type", "dm")
          .contains("member_ids", [rule.owner_id, c.id])
          .maybeSingle();
        if ((dmRoom as any)?.id) {
          await admin.from("chat_messages").insert({
            room_id: (dmRoom as any).id,
            sender_id: rule.owner_id,
            content: `🎯 '${p.title}' 볼트 참여 제안: ${matching_criteria}`,
            is_system: true,
          });
          dmSent++;
        }
      } catch {
        /* optional */
      }
    }
  }

  return {
    project_id: projectId,
    required_skills,
    matching_criteria,
    pool_size: pool.size,
    matched_user_ids,
    notified,
    crm_synced: crmSynced,
    dm_sent: dmSent,
  };
}
