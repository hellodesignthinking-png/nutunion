import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateTextForUser } from "@/lib/ai/vault";
import { log } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// in-memory cache: key = userId:personId:YYYY-MM-DD
const cache = new Map<string, { text: string; expires: number }>();

function dayKey(userId: string, personId: string): string {
  const d = new Date();
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const ymd = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2,"0")}-${String(kst.getUTCDate()).padStart(2,"0")}`;
  return `${userId}:${personId}:${ymd}`;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const cacheKey = dayKey(auth.user.id, id);
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json({ comment: cached.text, cached: true });
  }

  const [personRes, notesRes, eventsRes, projectsRes, groupsRes] = await Promise.all([
    supabase.from("people").select("display_name, role_hint, company, relationship, importance, notes, last_contact_at").eq("id", id).eq("owner_id", auth.user.id).maybeSingle(),
    supabase.from("person_context_notes").select("note, created_at").eq("person_id", id).eq("owner_id", auth.user.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("person_events").select("kind, title, event_date, detail").eq("person_id", id).eq("owner_id", auth.user.id),
    supabase.from("project_members").select("projects(title)").eq("user_id", auth.user.id).limit(5),
    supabase.from("group_members").select("groups(name)").eq("user_id", auth.user.id).eq("status", "active").limit(5),
  ]);

  if (!personRes.data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const person = personRes.data;
  const notes = (notesRes.data || []).map((n) => `- ${n.note}`).join("\n");
  const events = (eventsRes.data || []).map((e) => `- [${e.kind}] ${e.title} (${e.event_date})${e.detail ? ` — ${e.detail}` : ""}`).join("\n");
  const projects = ((projectsRes.data || []) as any[]).map((p) => p?.projects?.title).filter(Boolean).join(", ");
  const groups = ((groupsRes.data || []) as any[]).map((g) => g?.groups?.name).filter(Boolean).join(", ");

  const prompt = `[인물]
이름: ${person.display_name}
역할: ${person.role_hint || "-"}
소속: ${person.company || "-"}
관계: ${person.relationship || "-"}
중요도: ${person.importance}/5
최근 연락: ${person.last_contact_at || "기록 없음"}
메모: ${person.notes || "-"}

[최근 맥락 메모 (최대 5개)]
${notes || "- (없음)"}

[예정/관련 이벤트]
${events || "- (없음)"}

[내가 지금 몰두 중인 일]
볼트: ${projects || "-"}
너트: ${groups || "-"}

위 정보를 바탕으로, 오늘 이 사람에게 연락하거나 만날 때 도움이 될 조언을 정확히 한국어 2문장으로 작성하라.
- 맥락 메모에서 단서를 뽑아 실행 가능한 제안을 하라.
- 뻔한 인사/형식적 문장 금지. 구체적이고 따뜻하게.`;

  try {
    const res = await generateTextForUser(auth.user.id, {
      system: "당신은 사용자의 인맥 관리 비서다. 최근 맥락 메모와 이벤트를 읽고, 오늘 이 사람을 만나거나 연락할 때 도움이 될 2문장 조언을 한국어로 반환하라.",
      prompt,
      tier: "fast",
      maxOutputTokens: 200,
    });
    const text = (res.text || "").trim();
    cache.set(cacheKey, { text, expires: Date.now() + 24 * 60 * 60 * 1000 });
    return NextResponse.json({ comment: text, model_used: res.model_used });
  } catch (err) {
    log.error(err, "people.ai_comment.failed", { user_id: auth.user.id, person_id: id });
    return NextResponse.json({ comment: "", error: "ai_failed" }, { status: 500 });
  }
}
