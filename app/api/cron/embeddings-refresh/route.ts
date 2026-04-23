import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 매일 실행 — 변경된 profile / project 의 임베딩 갱신
 *
 * 환경변수:
 *   CRON_SECRET           — Vercel Cron 인증
 *   SUPABASE_SERVICE_ROLE — DB 쓰기
 *   NEXT_PUBLIC_SUPABASE_URL
 *   OPENAI_API_KEY        — 임베딩 모델 호출 (없으면 skip)
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ skipped: "OPENAI_API_KEY missing" });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "SUPABASE env missing" }, { status: 501 });
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const [profileResult, projectResult] = await Promise.all([
    refreshProfiles(supabase, openaiKey),
    refreshProjects(supabase, openaiKey),
  ]);

  return NextResponse.json({
    profiles: profileResult,
    projects: projectResult,
    ran_at: new Date().toISOString(),
  });
}

function hashText(s: string) {
  return crypto.createHash("sha1").update(s).digest("hex");
}

async function embed(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 8000) }),
    });
    const data = await res.json();
    return data.data?.[0]?.embedding || null;
  } catch {
    return null;
  }
}

async function refreshProfiles(supabase: any, apiKey: string) {
  // 최근 30일 내 업데이트되거나 임베딩이 없는 프로필 최대 50개
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nickname, bio, slogan, specialty, skill_tags")
    .order("updated_at", { ascending: false })
    .limit(50);

  let updated = 0;
  for (const p of profiles || []) {
    const text = [
      p.nickname, p.slogan, p.bio, p.specialty,
      ...(p.skill_tags || []),
    ].filter(Boolean).join("\n");
    if (!text.trim()) continue;
    const hash = hashText(text);

    const { data: existing } = await supabase
      .from("profile_embeddings")
      .select("source_hash")
      .eq("profile_id", p.id)
      .maybeSingle();
    if (existing?.source_hash === hash) continue;

    const vec = await embed(text, apiKey);
    if (!vec) continue;

    await supabase.from("profile_embeddings").upsert({
      profile_id: p.id,
      embedding: vec,
      source_hash: hash,
      model: "text-embedding-3-small",
      updated_at: new Date().toISOString(),
    });
    updated++;
  }
  return { scanned: profiles?.length || 0, updated };
}

async function refreshProjects(supabase: any, apiKey: string) {
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, description, category, needed_roles, role_slots")
    .in("status", ["active", "draft"])
    .order("updated_at", { ascending: false })
    .limit(50);

  let updated = 0;
  for (const p of projects || []) {
    const slots = Array.isArray(p.role_slots) ? p.role_slots.map((s: any) => s.description || s.role_type).join(", ") : "";
    const text = [
      p.title, p.description, p.category,
      ...(p.needed_roles || []),
      slots,
    ].filter(Boolean).join("\n");
    if (!text.trim()) continue;
    const hash = hashText(text);

    const { data: existing } = await supabase
      .from("project_embeddings")
      .select("source_hash")
      .eq("project_id", p.id)
      .maybeSingle();
    if (existing?.source_hash === hash) continue;

    const vec = await embed(text, apiKey);
    if (!vec) continue;

    await supabase.from("project_embeddings").upsert({
      project_id: p.id,
      embedding: vec,
      source_hash: hash,
      model: "text-embedding-3-small",
      updated_at: new Date().toISOString(),
    });
    updated++;
  }
  return { scanned: projects?.length || 0, updated };
}
