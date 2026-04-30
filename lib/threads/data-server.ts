import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ThreadDataRow {
  id: string;
  installation_id: string;
  data: any;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function listThreadDataServer(
  installationId: string,
  opts: { limit?: number; before?: string } = {},
): Promise<ThreadDataRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("thread_data")
    .select("*")
    .eq("installation_id", installationId)
    .order("created_at", { ascending: false });
  if (opts.limit) q = q.limit(opts.limit);
  if (opts.before) q = q.lt("created_at", opts.before);
  const { data, error } = await q;
  if (error) {
    if (/relation .* does not exist/i.test(error.message) || (error as any).code === "42P01") {
      return [];
    }
    throw error;
  }
  return (data as ThreadDataRow[]) || [];
}
