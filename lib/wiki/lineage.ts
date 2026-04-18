import { createClient } from "@/lib/supabase/server";

export interface LineagePage {
  id: string;
  title: string;
  topic_id: string | null;
  created_by: string | null;
  created_by_name?: string | null;
  original_author_id: string | null;
  forked_from: string | null;
  fork_depth: number;
  created_at: string;
}

export interface Connection {
  source_id: string;
  target_id: string;
  relation: string;
  note: string | null;
  target_title?: string;
  source_title?: string;
}

/** 주어진 페이지의 조상 체인 (root → 현재) 조회 */
export async function getAncestry(pageId: string): Promise<LineagePage[]> {
  const supabase = await createClient();
  const chain: LineagePage[] = [];
  let current: string | null = pageId;
  const seen = new Set<string>();

  while (current && !seen.has(current) && chain.length < 20) {
    seen.add(current);
    const res = await supabase
      .from("wiki_pages")
      .select("id, title, topic_id, created_by, original_author_id, forked_from, fork_depth, created_at")
      .eq("id", current)
      .maybeSingle();
    const row = res.data as LineagePage | null;
    if (!row) break;
    chain.unshift(row);
    current = row.forked_from;
  }

  // 이름 붙이기
  const creatorIds = [...new Set(chain.map((p) => p.created_by).filter(Boolean))] as string[];
  if (creatorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nickname")
      .in("id", creatorIds);
    const nameMap = new Map((profiles as { id: string; nickname: string | null }[] | null ?? []).map((p) => [p.id, p.nickname]));
    for (const p of chain) {
      if (p.created_by) p.created_by_name = nameMap.get(p.created_by) ?? null;
    }
  }
  return chain;
}

/** 자손(forked_from = pageId) 목록 */
export async function getDescendants(pageId: string): Promise<LineagePage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("wiki_pages")
    .select("id, title, topic_id, created_by, original_author_id, forked_from, fork_depth, created_at")
    .eq("forked_from", pageId)
    .order("created_at", { ascending: false });
  return (data as LineagePage[]) ?? [];
}

/** 양방향 연결 */
export async function getConnections(pageId: string): Promise<{ outgoing: Connection[]; incoming: Connection[] }> {
  const supabase = await createClient();
  const [out, inc] = await Promise.all([
    supabase
      .from("wiki_page_connections")
      .select("source_id, target_id, relation, note, target:wiki_pages!wiki_page_connections_target_id_fkey(title)")
      .eq("source_id", pageId),
    supabase
      .from("wiki_page_connections")
      .select("source_id, target_id, relation, note, source:wiki_pages!wiki_page_connections_source_id_fkey(title)")
      .eq("target_id", pageId),
  ]);

  type OutRow = { source_id: string; target_id: string; relation: string; note: string | null; target: { title: string } | { title: string }[] | null };
  type InRow  = { source_id: string; target_id: string; relation: string; note: string | null; source: { title: string } | { title: string }[] | null };

  const outRows = ((out.data as OutRow[] | null) ?? []).map((r) => ({
    source_id: r.source_id,
    target_id: r.target_id,
    relation: r.relation,
    note: r.note,
    target_title: Array.isArray(r.target) ? r.target[0]?.title : r.target?.title,
  }));
  const inRows = ((inc.data as InRow[] | null) ?? []).map((r) => ({
    source_id: r.source_id,
    target_id: r.target_id,
    relation: r.relation,
    note: r.note,
    source_title: Array.isArray(r.source) ? r.source[0]?.title : r.source?.title,
  }));
  return { outgoing: outRows, incoming: inRows };
}
