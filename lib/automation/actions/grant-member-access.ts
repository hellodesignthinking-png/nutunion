/**
 * Action: grant_member_access — log resource access + optional Drive share.
 *
 * 1. Inserts a member_resource_access row (audit trail).
 * 2. If scope=group and the group has google_drive_folder_id, grants reader
 *    permission on the folder to the new member's email via the host's OAuth client.
 *    Degrades gracefully if Google not connected or email missing.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { getGoogleClient } from "@/lib/google/auth";

type Ctx = {
  admin: SupabaseClient;
  rule: any;
  payload: any;
  params: { include_drive?: boolean };
};

export default async function grantMemberAccess({ admin, rule, payload, params }: Ctx) {
  const memberId = payload?.user_id || payload?.member_id;
  const groupId = payload?.group_id || payload?.groupId;
  const projectId = payload?.project_id || payload?.projectId;
  const scope: "group" | "project" | null = groupId ? "group" : projectId ? "project" : null;
  const scopeId = groupId || projectId;

  if (!memberId || !scope || !scopeId) {
    return { skipped: true, reason: "missing member_id / scope" };
  }

  // 1) Audit log insert (idempotent-ish: skip if already exists and unrevoked)
  const { data: existing } = await admin
    .from("member_resource_access")
    .select("id")
    .eq("member_id", memberId)
    .eq("scope", scope)
    .eq("scope_id", scopeId)
    .is("revoked_at", null)
    .maybeSingle();

  if (!existing) {
    const { error: logErr } = await admin.from("member_resource_access").insert({
      member_id: memberId,
      scope,
      scope_id: scopeId,
      grant_source: "automation",
    });
    if (logErr) {
      // Table missing? Skip quietly so rule doesn't fail outright.
      if (!/relation .* does not exist/i.test(logErr.message)) {
        throw new Error(logErr.message);
      }
    }
  }

  const result: Record<string, any> = {
    member_id: memberId,
    scope,
    scope_id: scopeId,
    audit_logged: true,
  };

  // 2) Optional Google Drive share (group scope only)
  if (params.include_drive && scope === "group") {
    try {
      const { data: group } = await admin
        .from("groups")
        .select("google_drive_folder_id, host_id, created_by")
        .eq("id", scopeId)
        .maybeSingle();

      const folderId = (group as any)?.google_drive_folder_id;
      const hostId = (group as any)?.host_id || (group as any)?.created_by || rule.owner_id;

      if (!folderId) {
        result.drive_share = "skipped_no_folder";
      } else {
        const { data: memberProfile } = await admin
          .from("profiles")
          .select("email")
          .eq("id", memberId)
          .maybeSingle();

        const email = (memberProfile as any)?.email;
        if (!email) {
          result.drive_share = "skipped_no_email";
        } else {
          try {
            const oauth = await getGoogleClient(hostId);
            const drive = google.drive({ version: "v3", auth: oauth });
            await drive.permissions.create({
              fileId: folderId,
              requestBody: { role: "reader", type: "user", emailAddress: email },
              sendNotificationEmail: false,
              supportsAllDrives: true,
            });
            result.drive_share = "granted";
            result.drive_email = email;
          } catch (e: any) {
            const msg = e?.message || String(e);
            if (msg.includes("GOOGLE_NOT_CONNECTED") || msg.includes("GOOGLE_TOKEN_EXPIRED")) {
              result.drive_share = "skipped_google_not_connected";
            } else {
              result.drive_share = "failed";
              result.drive_error = msg;
            }
          }
        }
      }
    } catch (e: any) {
      result.drive_share = "failed";
      result.drive_error = e?.message || String(e);
    }
  }

  return result;
}
