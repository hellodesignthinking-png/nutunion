/**
 * Action: send_chat_message — post a system message into the chat room bound
 * to the payload's group or project.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type Ctx = {
  admin: SupabaseClient;
  rule: any;
  payload: any;
  params: { template?: string };
};

function interpolate(tpl: string, payload: any): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => {
    const v = payload?.[k];
    return v == null ? `{${k}}` : String(v);
  });
}

export default async function sendChatMessage({ admin, rule, payload, params }: Ctx) {
  const gid = payload?.group_id || payload?.groupId || null;
  const pid = payload?.project_id || payload?.projectId || null;

  let roomId: string | null = null;
  if (pid) {
    const { data } = await admin
      .from("chat_rooms")
      .select("id")
      .eq("project_id", pid)
      .maybeSingle();
    roomId = data?.id || null;
  }
  if (!roomId && gid) {
    const { data } = await admin
      .from("chat_rooms")
      .select("id")
      .eq("group_id", gid)
      .maybeSingle();
    roomId = data?.id || null;
  }
  if (!roomId) return { skipped: true, reason: "no chat room for payload" };

  const content = interpolate(params.template || "🤖 자동화: 이벤트가 발생했어요.", payload);

  const { error } = await admin.from("chat_messages").insert({
    room_id: roomId,
    sender_id: rule.owner_id,
    content,
    is_system: true,
  });
  if (error) throw new Error(error.message);

  return { room_id: roomId, content };
}
