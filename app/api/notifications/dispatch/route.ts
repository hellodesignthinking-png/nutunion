import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dispatchNotification } from "@/lib/notifications/dispatch";

export const dynamic = "force-dynamic";

/**
 * POST /api/notifications/dispatch
 *  — Thin wrapper around server-side dispatchNotification helper.
 *  Auth: caller must be logged in. If actorId is supplied it must equal caller.id.
 *
 *  Body: {
 *    recipientUserId: string,
 *    type: string,
 *    title: string,
 *    body?: string,
 *    link_url?: string,
 *    metadata?: Record<string, any>,
 *    actorId?: string,
 *    category?: string,
 *    channels?: ("inapp"|"email"|"kakao"|"push")[],
 *  }
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const {
    recipientUserId,
    type,
    title,
    body,
    link_url,
    metadata,
    actorId,
    category,
    channels,
  } = payload || {};

  if (!recipientUserId || typeof recipientUserId !== "string") {
    return NextResponse.json({ error: "recipientUserId required" }, { status: 400 });
  }
  if (!type || typeof type !== "string") {
    return NextResponse.json({ error: "type required" }, { status: 400 });
  }
  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  // If actorId supplied, must match caller. Anyone can send to themselves.
  if (actorId && actorId !== auth.user.id) {
    return NextResponse.json({ error: "actorId must match caller" }, { status: 403 });
  }

  try {
    const result = await dispatchNotification({
      recipientId: recipientUserId,
      eventType: type,
      title,
      body: body ?? "",
      linkUrl: link_url,
      metadata: metadata ?? {},
      category,
      actorId: actorId ?? auth.user.id,
      channels: Array.isArray(channels) ? channels : ["inapp"],
    });
    return NextResponse.json({ ok: true, delivered: result.delivered });
  } catch (e: any) {
    console.error("[notifications.dispatch POST]", e);
    return NextResponse.json({ error: e?.message || "dispatch_failed" }, { status: 500 });
  }
}
