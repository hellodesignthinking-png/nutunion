"use client";

// Client-side helper for thread_data CRUD via /api/threads/data.
// All calls go through the API route so RLS / membership checks happen server-side.

export interface ThreadDataRow {
  id: string;
  installation_id: string;
  data: any;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function listThreadData(
  installationId: string,
  opts: { limit?: number; before?: string } = {},
): Promise<ThreadDataRow[]> {
  const params = new URLSearchParams({ installation_id: installationId });
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.before) params.set("before", opts.before);
  const res = await fetch(`/api/threads/data?${params.toString()}`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "list_failed");
  return json.rows || [];
}

export async function createThreadData(installationId: string, data: any): Promise<ThreadDataRow> {
  const res = await fetch("/api/threads/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ installation_id: installationId, data }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "create_failed");
  return json.row;
}

export async function updateThreadData(id: string, data: any): Promise<ThreadDataRow> {
  const res = await fetch("/api/threads/data", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, data }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "update_failed");
  return json.row;
}

export async function deleteThreadData(id: string): Promise<void> {
  const res = await fetch("/api/threads/data", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "delete_failed");
  }
}
