import { createClient } from "@/lib/supabase/server";

export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  category?: string;
  linkUrl?: string;
  actorId?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  const supabase = await createClient();

  const {
    userId,
    type,
    title,
    body,
    category = "general",
    linkUrl,
    actorId,
    metadata = {},
  } = params;

  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type,
    title,
    body: body || null,
    category,
    link_url: linkUrl || null,
    actor_id: actorId || null,
    metadata,
    is_read: false,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Failed to create notification:", error);
    throw error;
  }
}
