import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Kind = "note" | "task" | "track" | "wiki" | "meeting" | "file" | "person" | "group" | "project";

interface SearchResult {
  kind: Kind;
  id: string;
  title: string;
  snippet: string;
  href: string;
  icon: string;
  updated_at: string;
}

function snip(text: string | null | undefined, q: string, len = 150): string {
  if (!text) return "";
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text.slice(0, len);
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + q.length + (len - 40));
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

export const POST = withRouteLog("search.global", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const query: string = (body?.query || "").trim();
  const limit: number = Math.min(Math.max(body?.limit || 5, 1), 10);
  if (!query || query.length < 2) {
    return NextResponse.json({ results: [], counts: {} });
  }

  const uid = auth.user.id;
  const pattern = `%${query.replace(/[%_]/g, (m) => `\\${m}`)}%`;

  const [
    notesRes, tasksRes, todosRes, tracksRes, wikiRes, meetingsRes,
    filesRes, resourcesRes, peopleRes, groupsRes, projectsRes,
  ] = await Promise.all([
    supabase.from("personal_notes").select("id, title, content, updated_at, icon").eq("user_id", uid).or(`title.ilike.${pattern},content.ilike.${pattern}`).order("updated_at", { ascending: false }).limit(limit).then((r) => r, () => ({ data: [] as any[] })),
    supabase.from("personal_tasks").select("id, title, description, updated_at").eq("user_id", uid).ilike("title", pattern).order("updated_at", { ascending: false }).limit(limit).then((r) => r, () => ({ data: [] as any[] })),
    supabase.from("personal_todos").select("id, title, updated_at").eq("user_id", uid).ilike("title", pattern).order("updated_at", { ascending: false }).limit(limit).then((r) => r, () => ({ data: [] as any[] })),
    supabase.from("personal_projects").select("id, title, description, updated_at").eq("user_id", uid).or(`title.ilike.${pattern},description.ilike.${pattern}`).order("updated_at", { ascending: false }).limit(limit).then((r) => r, () => ({ data: [] as any[] })),
    supabase.from("wiki_pages").select("id, title, content, updated_at").or(`title.ilike.${pattern},content.ilike.${pattern}`).order("updated_at", { ascending: false }).limit(limit).then((r) => r, () => ({ data: [] as any[] })),
    supabase.from("meetings").select("id, title, summary, group_id, scheduled_at").or(`title.ilike.${pattern},summary.ilike.${pattern}`).order("scheduled_at", { ascending: false }).limit(limit).then((r) => r, () => ({ data: [] as any[] })),
    supabase.from("file_attachments").select("id, file_name, target_type, target_id, created_at").ilike("file_name", pattern).order("created_at", { ascending: false }).limit(limit).then((r) => r, () => ({ data: [] as any[] })),
    supabase.from("project_resources").select("id, name, project_id, created_at").ilike("name", pattern).order("created_at", { ascending: false }).limit(limit).then((r) => r, () => ({ data: [] as any[] })),
    supabase.from("people").select("id, display_name, notes, tags, updated_at, created_at").eq("owner_id", uid).or(`display_name.ilike.${pattern},notes.ilike.${pattern}`).limit(limit).then((r) => r, () => ({ data: [] as any[] })),
    supabase.from("groups").select("id, name, description, updated_at").or(`name.ilike.${pattern},description.ilike.${pattern}`).order("updated_at", { ascending: false }).limit(limit).then((r) => r, () => ({ data: [] as any[] })),
    supabase.from("projects").select("id, title, description, updated_at").or(`title.ilike.${pattern},description.ilike.${pattern}`).order("updated_at", { ascending: false }).limit(limit).then((r) => r, () => ({ data: [] as any[] })),
  ]);

  const results: SearchResult[] = [];

  for (const n of (notesRes.data || [])) {
    results.push({ kind: "note", id: n.id, title: n.title || "(제목 없음)", snippet: snip(n.content, query), href: "/notes", icon: n.icon || "📝", updated_at: n.updated_at });
  }
  for (const t of (tasksRes.data || [])) {
    results.push({ kind: "task", id: t.id, title: t.title, snippet: snip(t.description, query), href: "/dashboard#tasks", icon: "✅", updated_at: t.updated_at });
  }
  for (const t of (todosRes.data || [])) {
    results.push({ kind: "task", id: t.id, title: t.title, snippet: "", href: "/dashboard#tasks", icon: "☑️", updated_at: t.updated_at });
  }
  for (const t of (tracksRes.data || [])) {
    results.push({ kind: "track", id: t.id, title: t.title, snippet: snip(t.description, query), href: "/tracks", icon: "🏃", updated_at: t.updated_at });
  }
  for (const w of (wikiRes.data || [])) {
    results.push({ kind: "wiki", id: w.id, title: w.title, snippet: snip(w.content, query), href: `/wiki`, icon: "📚", updated_at: w.updated_at });
  }
  for (const m of (meetingsRes.data || [])) {
    results.push({ kind: "meeting", id: m.id, title: m.title, snippet: snip(m.summary, query), href: `/groups/${m.group_id}`, icon: "📅", updated_at: m.scheduled_at });
  }
  for (const f of (filesRes.data || [])) {
    results.push({ kind: "file", id: f.id, title: f.file_name, snippet: `${f.target_type}`, href: f.target_type === "group" ? `/groups/${f.target_id}` : f.target_type === "project" ? `/projects/${f.target_id}` : "/dashboard", icon: "📎", updated_at: f.created_at });
  }
  for (const r of (resourcesRes.data || [])) {
    results.push({ kind: "file", id: r.id, title: r.name, snippet: "project resource", href: `/projects/${r.project_id}`, icon: "📂", updated_at: r.created_at });
  }
  for (const p of (peopleRes.data || [])) {
    results.push({ kind: "person", id: p.id, title: p.display_name, snippet: snip(p.notes, query) || (p.tags || []).join(", "), href: `/people/${p.id}`, icon: "👤", updated_at: p.updated_at || p.created_at });
  }
  for (const g of (groupsRes.data || [])) {
    results.push({ kind: "group", id: g.id, title: g.name, snippet: snip(g.description, query), href: `/groups/${g.id}`, icon: "🔩", updated_at: g.updated_at });
  }
  for (const pr of (projectsRes.data || [])) {
    results.push({ kind: "project", id: pr.id, title: pr.title, snippet: snip(pr.description, query), href: `/projects/${pr.id}`, icon: "🚀", updated_at: pr.updated_at });
  }

  // Sort newest first
  results.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));

  const counts: Record<string, number> = {};
  for (const r of results) counts[r.kind] = (counts[r.kind] || 0) + 1;

  return NextResponse.json({ results, counts });
});
