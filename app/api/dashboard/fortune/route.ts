import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateTextForUser } from "@/lib/ai/vault";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";

export const dynamic = "force-dynamic";

const KST_OFFSET_MIN = 9 * 60;
function kstToday(): string {
  const d = new Date();
  const kst = new Date(d.getTime() + (KST_OFFSET_MIN - d.getTimezoneOffset()) * 60000);
  return kst.toISOString().slice(0, 10);
}

// in-memory daily cache
interface FortuneEntry { text: string; model_used: string | null; date: string }
const fortuneCache = new Map<string, FortuneEntry>();

export const GET = withRouteLog("dashboard.fortune", async () => {
  const span = log.span("dashboard.fortune");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    span.end({ status: 401 });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const date = kstToday();
  const key = `fortune:${user.id}:${date}`;
  const cached = fortuneCache.get(key);
  if (cached && cached.date === date) {
    span.end({ cache: "hit" });
    return NextResponse.json({ text: cached.text, model_used: cached.model_used, date, cached: true });
  }

  // 프로필 + 활동 중 볼트 — migration 102 미적용 환경에서도 안전
  let profile: any = null;
  {
    const res = await supabase
      .from("profiles")
      .select("nickname, specialty, birth_date, gender, address_region")
      .eq("id", user.id)
      .maybeSingle();
    if (res.error && /birth_date|gender|address_region/.test(res.error.message || "")) {
      const fb = await supabase
        .from("profiles")
        .select("nickname, specialty")
        .eq("id", user.id)
        .maybeSingle();
      profile = fb.data;
    } else {
      profile = res.data;
    }
  }
  const { data: pm } = await supabase
    .from("project_members")
    .select("projects(title, status)")
    .eq("user_id", user.id);
  const activeBolts = ((pm as any[]) || [])
    .map((r) => (Array.isArray(r.projects) ? r.projects[0] : r.projects))
    .filter((p: any) => p && ["active", "draft"].includes(p.status))
    .map((p: any) => p.title)
    .slice(0, 5);

  const d = new Date();
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][new Date(d.getTime() + KST_OFFSET_MIN * 60000).getUTCDay()];
  const nickname = profile?.nickname?.trim() || "당신";

  const system = `당신은 한국어로 짧고 강한 격언을 주는 운세 코치다.
- 점성술이 아닌 행동 전략 관점의 "오늘의 운세"
- 정확히 2문장
- 이모지 최대 1개
- 두 번째 문장은 오늘 하면 좋은 행동 1가지
`;

  const personalLines: string[] = [];
  if (profile?.birth_date) {
    personalLines.push(`생년월일: ${profile.birth_date}${profile?.gender ? `, 성별: ${profile.gender}` : ""}`);
  }
  if (profile?.address_region) {
    personalLines.push(`거주지: ${profile.address_region}`);
  }

  const prompt = `오늘은 ${date} ${weekday}요일.
${nickname}님의 활동 중 볼트: ${activeBolts.join(", ") || "(없음)"}
전문 분야: ${profile?.specialty || "(미지정)"}
${personalLines.join("\n")}

신비주의나 점성술적 주장 없이, 생년월일/성별은 연령대·삶의 단계 정도의 힌트로만 활용하여
오늘의 합리적 행동 타이밍 팁과 1가지 실행 행동을 2문장으로 제시하라.`;

  let text = "오늘은 작은 진전 하나로 충분합니다. 가장 오래 묵힌 일에 15분만 투자해보세요.";
  let model_used: string | null = null;
  try {
    const res = await generateTextForUser(user.id, { system, prompt, tier: "fast", maxOutputTokens: 200 });
    if (res.text?.trim()) text = res.text.trim();
    model_used = res.model_used;
  } catch (err: any) {
    log.warn("fortune.ai_failed", { error: err?.message });
  }

  const entry: FortuneEntry = { text, model_used, date };
  fortuneCache.set(key, entry);
  span.end({ cache: "miss" });
  return NextResponse.json({ ...entry, cached: false });
});
