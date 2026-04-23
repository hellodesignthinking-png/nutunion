import { flag, dedupe } from "flags/next";
import { vercelAdapter } from "@flags-sdk/vercel";
import { createClient } from "@/lib/supabase/server";

// FLAGS env 부재 시 adapter 없이 decide() 만 사용 (graceful degradation)
const hasVercelFlags = !!process.env.FLAGS;
const maybeAdapter: any = hasVercelFlags ? vercelAdapter() : undefined;

/**
 * nutunion 피처 플래그 — 로드맵 남은 4건의 점진적 롤아웃 제어
 *
 * 사용 방법 (서버 컴포넌트/라우트):
 *   import { contractsEnabled } from '@/lib/flags';
 *   const enabled = await contractsEnabled();
 *
 * 로컬 오버라이드:
 *   Vercel Toolbar → Flags Explorer 에서 켜고 끄기
 *
 * 환경변수:
 *   FLAGS          — SDK Key (Vercel Dashboard 에서 플래그 생성 시 자동 주입)
 *   FLAGS_SECRET   — 32-byte base64 (openssl rand -base64 32)
 *
 * 어댑터 부재 시 (FLAGS 미설정) decide() 기본값으로 graceful fallback.
 */

type Entities = {
  user?: { id: string; email?: string; role?: string };
};

const identify = dedupe(async (): Promise<Entities> => {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    return {
      user: { id: user.id, email: user.email, role: profile?.role },
    };
  } catch {
    return {};
  }
});

// ============================================
// 로드맵 남은 4건 — 기본은 관리자에게만 노출
// ============================================

// ⑦ 계약서/세금계산서 자동화
export const contractsEnabled = flag<boolean, Entities>({
  key: "contracts-enabled",
  description: "볼트 용역 계약서 + 3.3% 원천징수 자동화",
  adapter: maybeAdapter,
  identify,
  decide: ({ entities }) => entities?.user?.role === "admin",
  defaultValue: false,
});

// ⑩ 유료 너트 멤버십
export const paidNutsEnabled = flag<boolean, Entities>({
  key: "paid-nuts-enabled",
  description: "유료 멤버십 기반 너트 (월 회비)",
  adapter: maybeAdapter,
  identify,
  decide: ({ entities }) => entities?.user?.role === "admin",
  defaultValue: false,
});

// ⑬ B2B 기관 발주 포털
export const b2bPortalEnabled = flag<boolean, Entities>({
  key: "b2b-portal-enabled",
  description: "기업·기관용 B2B 볼트 발주 포털",
  adapter: maybeAdapter,
  identify,
  decide: ({ entities }) => entities?.user?.role === "admin",
  defaultValue: false,
});

// ⑯ 크리에이터 이코노미 (탭 콘텐츠 유료 판매)
export const creatorEconomyEnabled = flag<boolean, Entities>({
  key: "creator-economy-enabled",
  description: "탭(Tap) 콘텐츠 유료 판매 / 템플릿 스토어",
  adapter: maybeAdapter,
  identify,
  decide: ({ entities }) => entities?.user?.role === "admin",
  defaultValue: false,
});

// 결제 E2E (소액 테스트 모드)
export const paymentE2eMode = flag<"test" | "live" | "off", Entities>({
  key: "payment-e2e-mode",
  description: "결제 E2E 테스트 모드 — test(샌드박스) / live(실결제) / off",
  options: [
    { value: "off", label: "Off" },
    { value: "test", label: "Test (Sandbox)" },
    { value: "live", label: "Live (Production)" },
  ],
  adapter: maybeAdapter,
  identify,
  decide: () => "off",
  defaultValue: "off",
});
