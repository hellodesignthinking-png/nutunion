import { dispatchNotification } from "./notifications/dispatch";

/**
 * Legacy thin wrapper — delegates to dispatchNotification.
 * Kept for backward compatibility with existing callers.
 */
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

  await dispatchNotification({
    recipientId: userId,
    eventType: type,
    title,
    body: body || "",
    linkUrl,
    metadata,
    category,
    actorId,
    channels: ["inapp"],
  });
}
