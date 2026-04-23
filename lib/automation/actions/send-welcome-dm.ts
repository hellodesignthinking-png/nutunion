/**
 * Action: send_welcome_dm — send a welcome DM to a newly-joined member.
 * Creates (or finds) a DM room between the rule owner and the new member.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type Ctx = {
  admin: SupabaseClient;
  rule: any;
  payload: any;
  params: { include_wiki_link?: boolean };
};

export default async function sendWelcomeDm({ admin, rule, payload, params }: Ctx) {
  const newUserId = payload?.user_id || payload?.member_id;
  const groupId = payload?.group_id;
  if (!newUserId) return { skipped: true, reason: "no user_id in payload" };

  // Try find existing DM
  const { data: existing } = await admin
    .from("chat_rooms")
    .select("id, chat_members!inner(user_id)")
    .eq("type", "dm");

  let roomId: string | null = null;
  if (Array.isArray(existing)) {
    for (const r of existing as any[]) {
      const memberIds: string[] = (r.chat_members || []).map((m: any) => m.user_id);
      if (memberIds.includes(newUserId) && memberIds.includes(rule.owner_id)) {
        roomId = r.id;
        break;
      }
    }
  }

  if (!roomId) {
    const { data: room, error: roomErr } = await admin
      .from("chat_rooms")
      .insert({ type: "dm", created_by: rule.owner_id })
      .select("id")
      .single();
    if (roomErr || !room) throw new Error(roomErr?.message || "room create failed");
    roomId = room.id;
    await admin.from("chat_members").insert([
      { room_id: roomId, user_id: rule.owner_id },
      { room_id: roomId, user_id: newUserId },
    ]);
  }

  let groupName = "";
  if (groupId) {
    const { data: g } = await admin.from("groups").select("name").eq("id", groupId).maybeSingle();
    groupName = (g as any)?.name || "";
  }

  const linkHint = params.include_wiki_link
    ? "\n볼트 위키에서 시작 가이드를 확인하실 수 있어요. 📚"
    : "";
  const content = `👋 ${groupName ? `${groupName} 에 오신 것을 환영해요!` : "환영해요!"}${linkHint}`;

  const { error } = await admin.from("chat_messages").insert({
    room_id: roomId,
    sender_id: rule.owner_id,
    content,
  });
  if (error) throw new Error(error.message);

  return { room_id: roomId, sent_to: newUserId };
}
