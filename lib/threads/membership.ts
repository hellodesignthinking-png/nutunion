import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Check that `userId` is a member of the nut/bolt that the installation lives in.
 * RLS on thread_data already filters rows on read, but mutating endpoints (POST/PATCH/DELETE)
 * accept an installation_id from the request body without going through that filter, so we
 * verify membership explicitly before touching the row.
 *
 * Returns:
 *   - { ok: true, installation } when the user is a member
 *   - { ok: false, status, error } with a stable string code otherwise
 */
export async function checkInstallationMembership(
  supabase: SupabaseClient,
  installationId: string,
  userId: string,
): Promise<
  | { ok: true; installation: { id: string; target_type: "nut" | "bolt"; target_id: string } }
  | { ok: false; status: number; error: string }
> {
  const { data: inst, error } = await supabase
    .from("thread_installations")
    .select("id, target_type, target_id")
    .eq("id", installationId)
    .maybeSingle();

  if (error) {
    if (/relation .* does not exist/i.test(error.message) || (error as any).code === "42P01") {
      return { ok: false, status: 503, error: "migration_115_missing" };
    }
    return { ok: false, status: 500, error: error.message };
  }
  if (!inst) return { ok: false, status: 404, error: "installation_not_found" };

  if (inst.target_type === "nut") {
    const { data: gm } = await supabase
      .from("group_members")
      .select("status")
      .eq("group_id", inst.target_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!gm || gm.status !== "active") return { ok: false, status: 403, error: "forbidden" };
  } else if (inst.target_type === "bolt") {
    const { data: pm } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", inst.target_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!pm) return { ok: false, status: 403, error: "forbidden" };
  } else {
    return { ok: false, status: 400, error: "unknown_target_type" };
  }

  return { ok: true, installation: inst as any };
}

/**
 * Same as above but starts from a thread_data row id — used by PATCH/DELETE that take only the
 * row id. We resolve the installation in one round-trip.
 */
export async function checkRowMembership(
  supabase: SupabaseClient,
  rowId: string,
  userId: string,
): Promise<
  | { ok: true; row: { id: string; installation_id: string; created_by: string } }
  | { ok: false; status: number; error: string }
> {
  const { data: row, error } = await supabase
    .from("thread_data")
    .select("id, installation_id, created_by")
    .eq("id", rowId)
    .maybeSingle();
  if (error) return { ok: false, status: 500, error: error.message };
  if (!row) return { ok: false, status: 404, error: "row_not_found" };

  const m = await checkInstallationMembership(supabase, row.installation_id, userId);
  if (!m.ok) return m;
  return { ok: true, row: row as any };
}
