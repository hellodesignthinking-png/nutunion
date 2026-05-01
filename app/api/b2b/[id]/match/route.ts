import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

/**
 * POST /api/b2b/[id]/match
 * B2B 발주에 대해 추천 너트 3개를 AI 로 매칭 → b2b_match_suggestions 저장
 *
 * 하이브리드:
 *   1차: OpenAI 임베딩 + group_embeddings pgvector 코사인 유사도
 *   2차: keyword/category 매칭 (임베딩 없을 때 graceful fallback)
 *
 * GET /api/b2b/[id]/match — 저장된 추천 조회
 */
export const POST = withRouteLog("b2b.id.match.post", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id: requestId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 발주 조회 + 권한 체크 (발주자 또는 admin)
  const { data: request } = await supabase
    .from("b2b_bolt_requests")
    .select("id, title, description, category, budget_min, budget_max, submitted_by, organization:b2b_organizations(id, name, created_by)")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  const org = Array.isArray(request.organization) ? request.organization[0] : request.organization;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const canRun = request.submitted_by === user.id || org?.created_by === user.id || profile?.role === "admin";
  if (!canRun) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // 1차: pgvector 매칭 시도
  const openaiKey = process.env.OPENAI_API_KEY;
  let matches: any[] = [];
  let method: "pgvector" | "keyword" = "keyword";

  if (openaiKey) {
    try {
      const queryText = [
        request.title,
        request.description,
        request.category,
      ].filter(Boolean).join("\n");

      const embRes = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: "text-embedding-3-small", input: queryText.slice(0, 8000) }),
      });
      const embData = await embRes.json();
      const vector = embData.data?.[0]?.embedding;

      if (vector) {
        const { data: rpcData } = await supabase.rpc("match_groups_by_embedding", {
          query_embedding: vector,
          match_count: 3,
        });
        if (rpcData && rpcData.length > 0) {
          matches = rpcData.map((m: any) => ({
            group_id: m.group_id,
            name: m.name,
            description: m.description,
            category: m.category,
            score: Math.max(0, 1 - (m.distance ?? 1)),
            reason: `임베딩 유사도 ${((1 - (m.distance ?? 1)) * 100).toFixed(0)}%${m.category === request.category ? " · 분야 일치" : ""}`,
          }));
          method = "pgvector";
        }
      }
    } catch (e: any) {
    log.error(e, "b2b.id.match.failed");
      console.warn("[b2b/match] pgvector path failed:", e.message);
    }
  }

  // 2차: keyword fallback
  if (matches.length === 0) {
    let q = supabase
      .from("groups")
      .select("id, name, description, category")
      .eq("is_active", true)
      .limit(10);
    if (request.category) q = q.eq("category", request.category);

    const { data } = await q;
    const keywords = (request.description || request.title || "")
      .toLowerCase()
      .split(/[\s,·.\n]/)
      .filter((w: string) => w.length >= 2);

    matches = (data || [])
      .map((g: any) => {
        const text = (g.name + " " + (g.description || "")).toLowerCase();
        const hits = keywords.filter((k: string) => text.includes(k)).length;
        const baseScore = request.category && g.category === request.category ? 0.6 : 0.3;
        const score = Math.min(1, baseScore + hits * 0.05);
        return {
          group_id: g.id,
          name: g.name,
          description: g.description,
          category: g.category,
          score,
          reason: hits > 0
            ? `키워드 ${hits}개 매치${request.category === g.category ? " · 분야 일치" : ""}`
            : `${g.category} 분야 활성 너트`,
        };
      })
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 3);
  }

  // service_role 로 저장 (RLS 우회)
  const svcUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  let saved = 0;
  if (svcUrl && svcKey && matches.length > 0) {
    const svc = createServiceClient(svcUrl, svcKey, { auth: { persistSession: false } });
    // 기존 suggested 리셋 (재매칭 시)
    await svc.from("b2b_match_suggestions")
      .delete()
      .eq("request_id", requestId)
      .eq("status", "suggested");

    const rows = matches.map((m, i) => ({
      request_id: requestId,
      group_id: m.group_id,
      rank: i + 1,
      match_score: m.score,
      reason: m.reason,
      method,
      status: "suggested",
    }));
    const { data: inserted } = await svc.from("b2b_match_suggestions").insert(rows).select("id");
    saved = inserted?.length || 0;

    // 발주 상태 → matching
    await svc.from("b2b_bolt_requests").update({ status: "matching", updated_at: new Date().toISOString() }).eq("id", requestId);
  }

  return NextResponse.json({ matches, method, saved });
});

export const GET = withRouteLog("b2b.id.match.get", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id: requestId } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("b2b_match_suggestions")
    .select("id, rank, match_score, reason, method, status, group:groups(id, name, description, category, image_url)")
    .eq("request_id", requestId)
    .order("rank");

  return NextResponse.json({ matches: data || [] });
});
