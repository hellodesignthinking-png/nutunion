/**
 * Action: post_file_to_chat — when a new resource is uploaded, share it into
 * the associated chat room.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type Ctx = {
  admin: SupabaseClient;
  rule: any;
  payload: any;
  params: Record<string, any>;
};

export default async function postFileToChat({ admin, rule, payload }: Ctx) {
  const gid = payload?.group_id || null;
  const pid = payload?.project_id || null;
  const fileName = payload?.file_name || "새 파일";
  const fileUrl = payload?.file_url || null;
  const fileType = payload?.file_type || "file";

  let roomId: string | null = null;
  if (pid) {
    const { data } = await admin.from("chat_rooms").select("id").eq("project_id", pid).maybeSingle();
    roomId = data?.id || null;
  }
  if (!roomId && gid) {
    const { data } = await admin.from("chat_rooms").select("id").eq("group_id", gid).maybeSingle();
    roomId = data?.id || null;
  }
  if (!roomId) return { skipped: true, reason: "no chat room" };

  const attachmentType =
    fileType.startsWith("image/") ? "image"
    : fileType.startsWith("audio/") ? "audio"
    : fileType.startsWith("video/") ? "video"
    : "file";

  const { error } = await admin.from("chat_messages").insert({
    room_id: roomId,
    sender_id: rule.owner_id,
    content: `📎 새 자료가 업로드됐어요: ${fileName}`,
    attachment_url: fileUrl,
    attachment_name: fileName,
    attachment_type: attachmentType,
    is_system: true,
  });
  if (error) throw new Error(error.message);

  return { room_id: roomId, file_name: fileName };
}
