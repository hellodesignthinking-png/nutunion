import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateTextForUser } from "@/lib/ai/vault";

const SYSTEM = `You are recommending Thread modules for a community/project tool.
Output STRICT JSON only with shape: {"recommendations":[{"slug":"...","reason":"<2-3 sentence Korean reason>"}]}.
Pick at most 3 from the provided candidates. No prose outside JSON.`;

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // AI prefs gate
  const { data: prof } = await supabase.from("profiles").select("ai_preferences").eq("id", user.id).maybeSingle();
  const prefs = (prof?.ai_preferences as any) || { enabled: true, features: [] };
  if (prefs.enabled === false || (Array.isArray(prefs.features) && prefs.features.length > 0 && !prefs.features.includes("thread_recommend"))) {
    return NextResponse.json({ recommendations: [] });
  }

  // user's nuts/bolts
  const { data: gms } = await supabase
    .from("group_members")
    .select("group_id, role, groups:groups(id, name, description)")
    .eq("user_id", user.id)
    .eq("status", "active");
  const { data: pms } = await supabase
    .from("project_members")
    .select("project_id, role, projects:projects(id, title, description)")
    .eq("user_id", user.id);

  const nuts = (gms || []).map((m: any) => m.groups).filter(Boolean);
  const bolts = (pms || []).map((m: any) => m.projects).filter(Boolean);

  if (nuts.length === 0 && bolts.length === 0) {
    return NextResponse.json({ recommendations: [] });
  }

  // Existing installations on user's targets
  const targetIds = [...nuts.map((n: any) => n.id), ...bolts.map((b: any) => b.id)];
  const { data: insts } = await supabase
    .from("thread_installations")
    .select("thread_id")
    .in("target_id", targetIds);
  const installedThreadIds = new Set((insts || []).map((i: any) => i.thread_id));

  // All public threads, exclude installed
  const { data: allThreads } = await supabase
    .from("threads")
    .select("id, slug, name, description, category, scope")
    .eq("is_public", true);

  const candidates = (allThreads || []).filter((t: any) => !installedThreadIds.has(t.id));
  if (candidates.length === 0) return NextResponse.json({ recommendations: [] });

  const candidateLines = candidates.map((c: any) => `- ${c.slug}: ${c.name} (${c.category}, ${(c.scope || []).join("/")}) — ${c.description || ""}`).join("\n");
  const targetLines = [
    ...nuts.map((n: any) => `너트: ${n.name} ${n.description ? `— ${n.description}` : ""}`),
    ...bolts.map((b: any) => `볼트: ${b.title} ${b.description ? `— ${b.description}` : ""}`),
  ].join("\n");

  const prompt = `사용자의 너트/볼트:\n${targetLines}\n\n설치 가능한 Thread 후보:\n${candidateLines}\n\n위 사용자에게 가장 잘 어울리는 Thread 3개를 골라 JSON 으로만 답하세요. 각 reason 은 한국어 2-3문장.`;

  try {
    const result = await generateTextForUser(user.id, {
      system: SYSTEM,
      prompt,
      tier: "fast",
      maxOutputTokens: 600,
    });

    // Parse JSON
    let parsed: any = null;
    const text = result.text || "";
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch { /* ignore */ }
    }
    const recs = Array.isArray(parsed?.recommendations) ? parsed.recommendations : [];
    // Validate slugs
    const slugSet = new Set(candidates.map((c: any) => c.slug));
    const filtered = recs.filter((r: any) => r && typeof r.slug === "string" && slugSet.has(r.slug)).slice(0, 3);

    return NextResponse.json({ recommendations: filtered, model_used: result.model_used });
  } catch (e: any) {
    return NextResponse.json({ recommendations: [], error: `ai_failed: ${e?.message || e}` });
  }
}
