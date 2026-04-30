/**
 * POST /api/genesis/plan
 * Genesis AI — 한 줄 의도 → 구조화된 로드맵 (phases + wikis + roles + tasks).
 *
 * Body: { intent: string, kind: "group" | "project" }
 * Response: { plan, model_used }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateObjectForUser, generateTextForUser } from "@/lib/ai/vault";
import { log } from "@/lib/observability/logger";

export const maxDuration = 60;

const PlanSchema = z.object({
  title: z.string(),
  summary: z.string(),
  category: z.string(),
  phases: z
    .array(
      z.object({
        name: z.string(),
        goal: z.string(),
        duration_days: z.number().nullable(),
        wiki_pages: z
          .array(
            z.object({
              title: z.string(),
              outline: z.string(),
            }),
          )
          .min(1)
          .max(4),
        milestones: z.array(z.string()).max(5),
      }),
    )
    .min(2)
    .max(6),
  suggested_roles: z
    .array(
      z.object({
        role_name: z.string(),
        specialty_tags: z.array(z.string()),
        why: z.string(),
      }),
    )
    .max(5),
  resources_folders: z.array(z.string()).max(6),
  first_tasks: z.array(z.string()).min(3).max(8),
});

export type GenesisPlan = z.infer<typeof PlanSchema>;

const SYSTEM = `당신은 nutunion 의 시니어 실행기획 비서입니다.
사용자가 한 줄로 적은 어떤 종류의 목표/프로젝트/실행 의도라도 받아서,
그 도메인에 맞는 한국어 로드맵으로 구조화합니다.

## 핵심 원칙
- **도메인을 먼저 추론하라**: 사용자의 의도가 어떤 분야에 속하는지 파악하고,
  그 분야의 실제 업무 흐름·산출물·전문 용어를 그대로 사용해 단계를 설계한다.
- **모르는 도메인이면 가장 가까운 패턴을 응용하라**: "절대 빈 배열/누락 금지".
  애매하면 추정해서 채운다.
- **단계 수는 복잡도에 맞춰**: 단순 목표 3-4 phase, 복잡 프로젝트 5-6 phase.
- **phase 이름은 도메인 용어로**: '01 단계명' 형식 + 그 도메인의 실제 표현.
  · 영상 → "촬영", "편집", "발행"
  · 부동산 → "임장", "임대", "계약"
  · 이커머스 → "소싱", "촬영", "상세페이지"
  · 행사 → "섭외", "리허설", "현장운영"
  · 운동 → "베이스", "강도훈련", "테이퍼"
  · 결혼식 → "베뉴", "스드메", "본식"
- **wiki_pages.outline 은 3-5개 bullet 마크다운** — 각 단계에서 정리할 핵심 가이드.
- **suggested_roles 는 실제 직무명 + 스킬 태그**.
- **first_tasks 는 오늘/내일 바로 시작 가능한 3-8개 행동** (구체적이고 동사로 시작).
- **resources_folders 는 도메인 자료실 폴더명** (예: 영상 → ["기획", "촬영본", "편집본"]).
- **category 는 한글 단어** ("콘텐츠", "운영", "학습", "부동산", "행사", "건강" 등).

## 도메인 예시 (이 외에도 무엇이든 가능)
- 비즈니스: 창업 → 발굴/검증/MVP/팀빌딩/펀딩, 매장 오픈 → 컨셉/입지/공사/마케팅/운영
- 콘텐츠: 유튜브 → 컨셉/기획/촬영편집/발행SEO/분석, 책출판 → 기획/집필/편집/출판/마케팅
- 테크: 앱/SaaS → 기획/MVP/배포/그로스/수익화, AI 모델 → 데이터/학습/평가/배포
- 교육: 스터디 → 목표/자료/학습/적용, 강의제작 → 커리큘럼/녹화/편집/론칭
- 부동산: LH검토 → 자료/분석/보고서/협상/매입, 매입임대 → 임장/감정/계약/임대
- 금융: 투자유치 → 데크/타겟/IR/실사/클로징, 자금관리 → 진단/체계/리포팅
- 마케팅: 캠페인 → 전략/크리에이티브/매체/집행/분석, SEO → 진단/키워드/콘텐츠
- 행사: 컨퍼런스 → 컨셉/섭외/운영준비/진행/회고, 팝업 → 컨셉/섭외/공간/운영
- 건강: 마라톤 → 베이스/강도/시뮬/테이퍼/대회, 다이어트 → 진단/식단/운동/유지
- 개인목표: 자격증 → 진단/계획/실전/모의/응시, 외국어 → 진단/인풋/아웃풋/실전
- 커뮤니티: 모임운영 → 컨셉/멤버/정기모임/콘텐츠/회고
- 리서치: 인터뷰 → 가설/모집/인터뷰/분석/인사이트, 시장조사 → 정의/수집/분석/리포트
- 제조: 제품 → 컨셉/설계/시제품/테스트/양산
- 실생활: 결혼식 → 컨셉/예산/베뉴/스드메/본식, 이사 → 짐정리/업체/계약/실행, 여행 → 목적지/일정/예약/짐/회고

도메인이 위에 없어도 동일한 사고로 추론해서 만들어라. 비어 있는 응답 금지.`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    const body = await request.json();
    const intent = String(body?.intent || "").trim();
    const kind = body?.kind === "project" ? "project" : "group";

    if (!intent) {
      return NextResponse.json({ error: "의도(intent)를 입력해주세요" }, { status: 400 });
    }
    if (intent.length > 500) {
      return NextResponse.json({ error: "의도는 500자 이내로 작성" }, { status: 400 });
    }

    const userPrompt = `## ${kind === "group" ? "너트(소모임)" : "볼트(프로젝트)"} 의도\n${intent}\n\n위 의도의 도메인을 추론하고 그에 맞는 실행 로드맵을 만들어주세요.\n- 공간 타입: ${kind}\n- phases 는 2~6 단계 (단순한 목표는 3-4, 복잡한 프로젝트는 5-6)\n- 각 phase 는 도메인 용어 그대로 (예: 영상 도메인이면 "촬영", "편집" 같은 단어 사용)\n- 각 phase 마다 1~4개 위키 페이지 초안\n- suggested_roles 는 그 도메인의 실제 직무명 (최대 5명)\n- first_tasks 는 오늘 바로 착수 가능한 3~8개 구체 과제\n- resources_folders 는 그 도메인 자료실 폴더 구성`;

    const attempts: Array<{ stage: string; error: string }> = [];

    // 1차 시도: generateObject (zod 자동 검증)
    let plan: GenesisPlan | null = null;
    let modelUsed = "";
    try {
      const res = await generateObjectForUser<GenesisPlan>(user.id, PlanSchema, {
        system: SYSTEM,
        prompt: userPrompt,
        maxOutputTokens: 4000,
        tier: "fast",
      });
      plan = res.object ?? null;
      modelUsed = res.model_used;
    } catch (objErr: any) {
      attempts.push({ stage: "generateObject", error: objErr?.message || String(objErr) });
      log.warn("genesis.plan.object_failed_fallback_text", { error: objErr?.message });
      // 2차 폴백: generateText + 수동 JSON 파싱
      try {
        const textPrompt = `${userPrompt}\n\n반드시 아래 JSON 스키마를 **정확히** 따라 JSON 만 반환하라 (마크다운 코드 블록 금지):\n{\n  "title": "string",\n  "summary": "string",\n  "category": "string",\n  "phases": [\n    {"name":"01 단계명","goal":"목표","duration_days":7,"wiki_pages":[{"title":"...","outline":"- 항목1\\n- 항목2"}],"milestones":["마일스톤1"]}\n  ],\n  "suggested_roles": [{"role_name":"...","specialty_tags":["..."],"why":"..."}],\n  "resources_folders": ["..."],\n  "first_tasks": ["..."]\n}\n제약: phases 2~6개, 각 phase 에 wiki_pages 1~4개, suggested_roles 최대 5개, resources_folders 최대 6개, first_tasks 3~8개.`;

        const textRes = await generateTextForUser(user.id, {
          system: SYSTEM + " 반드시 유효한 JSON 객체 하나만 반환하고 그 외 텍스트 금지.",
          prompt: textPrompt,
          maxOutputTokens: 6000,
          tier: "fast",
        });
        modelUsed = textRes.model_used + " (text-fallback)";

        const raw = (textRes.text || "").trim();
        const jsonStr = raw
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();
        const start = jsonStr.indexOf("{");
        const end = jsonStr.lastIndexOf("}");
        if (start < 0 || end < 0) {
          throw new Error(`AI 응답에서 JSON 을 찾을 수 없음 (길이 ${raw.length})`);
        }
        const sliced = jsonStr.slice(start, end + 1);
        const parsed = JSON.parse(sliced);
        const validated = PlanSchema.safeParse(parsed);
        if (!validated.success) {
          const lenient = z.object({
            title: z.string().default("새 공간"),
            summary: z.string().default(""),
            category: z.string().default("general"),
            phases: z.array(z.any()).default([]),
            suggested_roles: z.array(z.any()).default([]),
            resources_folders: z.array(z.any()).default([]),
            first_tasks: z.array(z.any()).default([]),
          });
          const lenientRes = lenient.safeParse(parsed);
          if (!lenientRes.success) throw new Error("AI 응답 스키마 불일치");
          plan = lenientRes.data as GenesisPlan;
        } else {
          plan = validated.data;
        }
      } catch (textErr: any) {
        attempts.push({ stage: "generateText", error: textErr?.message || String(textErr) });
        log.warn("genesis.plan.text_failed_fallback_template", { error: textErr?.message });
      }
    }

    // 3차 폴백: 의도 기반 템플릿 (AI 완전 실패 시에도 사용자가 빈손으로 떠나지 않도록)
    if (!plan) {
      plan = buildTemplatePlan(intent, kind);
      modelUsed = "template-fallback";
      attempts.push({ stage: "template", error: "AI 폴백 — 일반 템플릿 사용" });
    }

    if (!plan) {
      return NextResponse.json(
        { error: "AI 가 계획을 생성하지 못했어요. 잠시 후 다시 시도해주세요.", attempts },
        { status: 502 },
      );
    }

    log.info("genesis.plan.generated", {
      user_id: user.id,
      kind,
      model_used: modelUsed,
      phase_count: plan.phases?.length || 0,
    });

    return NextResponse.json({ plan, model_used: modelUsed, attempts });
  } catch (err: any) {
    log.error(err, "genesis.plan.failed");
    // 마지막 안전망 — outer catch 에서도 템플릿 반환 (사용자가 막히지 않도록)
    try {
      const body = await request.json().catch(() => ({} as any));
      const intent = String(body?.intent || "새 공간").trim();
      const kind = body?.kind === "project" ? "project" : "group";
      const fallbackPlan = buildTemplatePlan(intent, kind);
      return NextResponse.json({
        plan: fallbackPlan,
        model_used: "template-emergency",
        warning: err?.message || "AI 일시 장애 — 기본 템플릿 사용",
      });
    } catch {
      return NextResponse.json(
        { error: err?.message || "Genesis AI 계획 생성 실패" },
        { status: 500 },
      );
    }
  }
}

// ============================================================
// 템플릿 라이브러리 — AI 완전 실패 시 폴백
// ============================================================

type TemplateFn = (intent: string, kind: "group" | "project") => GenesisPlan;

interface TemplateEntry {
  key: string;
  /** 키워드 그룹들 — 그룹 안에 하나라도 있으면 1점, 그룹 단위로 가산 */
  keywords: string[][];
  build: TemplateFn;
}

/** 의도 점수 계산: 키워드 그룹 매칭 수 */
function scoreTemplate(intent: string, keywords: string[][]): number {
  let score = 0;
  const lower = intent.toLowerCase();
  for (const kwSet of keywords) {
    if (kwSet.some((k) => lower.includes(k.toLowerCase()))) score++;
  }
  return score;
}

/** 의도 키워드에서 도메인 감지 → 그에 맞는 일반 템플릿 반환.
 *  AI 완전 실패 시 fallback. 사용자가 후속에서 편집 가능. */
function buildTemplatePlan(intent: string, kind: "group" | "project"): GenesisPlan {
  // 점수 기반 매칭 — 가장 높은 점수의 템플릿 채택
  let bestKey = "general";
  let bestScore = 0;
  let bestBuild: TemplateFn = TEMPLATE_GENERAL;
  for (const entry of TEMPLATES) {
    const s = scoreTemplate(intent, entry.keywords);
    if (s > bestScore) {
      bestScore = s;
      bestKey = entry.key;
      bestBuild = entry.build;
    }
  }
  // 점수 0 = 매칭 없음 → general
  if (bestScore === 0) {
    return TEMPLATE_GENERAL(intent, kind);
  }
  log.info("genesis.template.matched", { key: bestKey, score: bestScore });
  return bestBuild(intent, kind);
}

// ── 빌더들 ──────────────────────────────────────────────────

const TEMPLATE_YOUTUBE: TemplateFn = (intent) => ({
  title: intent.slice(0, 60) || "유튜브 채널 성장",
  summary: `${intent} — 채널 컨셉부터 발행·분석 루프까지`,
  category: "콘텐츠",
  phases: [
    { name: "01 채널 컨셉", goal: "타겟 시청자/포지셔닝/브랜드 톤", duration_days: 7,
      wiki_pages: [{ title: "타겟 페르소나", outline: "- 시청자 1인 묘사\n- 그들의 문제\n- 해결법" }, { title: "채널 정체성", outline: "- 톤·매너\n- 비주얼 가이드" }],
      milestones: ["페르소나 정의", "채널명·로고 확정"] },
    { name: "02 콘텐츠 기획", goal: "초기 10편 + 시즌 로드맵", duration_days: 14,
      wiki_pages: [{ title: "콘텐츠 캘린더", outline: "- 주간 1편\n- 시리즈 구성\n- 후크 카피" }],
      milestones: ["10편 기획안", "썸네일 시안 3종"] },
    { name: "03 촬영·편집", goal: "발행 가능한 워크플로우", duration_days: 14,
      wiki_pages: [{ title: "촬영 체크리스트", outline: "- 장비\n- 조명\n- 오디오" }, { title: "편집 SOP", outline: "- 컷 흐름\n- 컬러\n- 자막" }],
      milestones: ["파일럿 1편 완성"] },
    { name: "04 발행·SEO", goal: "썸네일/제목/태그 최적화", duration_days: 7,
      wiki_pages: [{ title: "발행 체크리스트", outline: "- 제목 A/B\n- 썸네일 CTR\n- 태그" }],
      milestones: ["10편 발행", "구독 100"] },
    { name: "05 분석·반복", goal: "데이터 기반 개선 루프", duration_days: 14,
      wiki_pages: [{ title: "지표 보드", outline: "- CTR\n- 시청 유지율\n- 구독 전환" }],
      milestones: ["월간 회고", "Top 패턴 추출"] },
  ],
  suggested_roles: [
    { role_name: "기획·연출", specialty_tags: ["스토리텔링"], why: "콘텐츠 방향성" },
    { role_name: "촬영·편집", specialty_tags: ["프리미어", "다빈치"], why: "주간 발행" },
    { role_name: "썸네일 디자이너", specialty_tags: ["포토샵"], why: "CTR" },
    { role_name: "마케터", specialty_tags: ["SEO", "광고"], why: "발견 가능성" },
  ],
  resources_folders: ["기획안", "촬영본", "편집본", "썸네일", "분석"],
  first_tasks: ["타겟 페르소나 1명 정의", "유사 채널 5개 분석", "초기 10편 주제 브레인스토밍", "채널 아트 시안", "촬영 장비 점검"],
});

const TEMPLATE_CAFE: TemplateFn = (intent) => ({
  title: intent.slice(0, 60) || "공간 운영",
  summary: `${intent} — 컨셉부터 운영까지`,
  category: "운영",
  phases: [
    { name: "01 컨셉", goal: "정체성·고객·경험 정의", duration_days: 14,
      wiki_pages: [{ title: "컨셉 보드", outline: "- 무드\n- 타겟\n- 차별점" }], milestones: ["컨셉북 완성"] },
    { name: "02 입지·임대", goal: "후보지 비교 + 계약", duration_days: 30,
      wiki_pages: [{ title: "입지 평가", outline: "- 유동인구\n- 임대료\n- 경쟁점" }], milestones: ["계약 완료"] },
    { name: "03 인테리어·메뉴", goal: "공사 + 핵심 상품", duration_days: 60,
      wiki_pages: [{ title: "메뉴 개발 노트", outline: "- 시그니처\n- 원가\n- 가격" }], milestones: ["오픈 가능"] },
    { name: "04 마케팅·오픈", goal: "프리오픈 + 정식 오픈", duration_days: 14,
      wiki_pages: [{ title: "오픈 캠페인", outline: "- SNS\n- 인플루언서\n- 이벤트" }], milestones: ["정식 오픈"] },
    { name: "05 운영·개선", goal: "주간 데이터 기반 개선", duration_days: 30,
      wiki_pages: [{ title: "주간 회고", outline: "- 매출\n- CS\n- 메뉴 반응" }], milestones: ["월매출 목표"] },
  ],
  suggested_roles: [
    { role_name: "공간 디자이너", specialty_tags: ["인테리어"], why: "브랜드 경험" },
    { role_name: "메뉴 개발", specialty_tags: ["F&B"], why: "핵심 상품" },
    { role_name: "마케터", specialty_tags: ["SNS"], why: "고객 유입" },
  ],
  resources_folders: ["컨셉", "입지", "메뉴", "마케팅", "운영"],
  first_tasks: ["컨셉 한 문장 정리", "예산 시뮬레이션", "유사 매장 3곳 답사", "후보 입지 5곳 리스트", "법인/사업자 준비"],
});

const TEMPLATE_STUDY: TemplateFn = (intent) => ({
  title: intent.slice(0, 60) || "학습 프로젝트",
  summary: `${intent} — 학습 → 적용 → 공유 루프`,
  category: "학습",
  phases: [
    { name: "01 목표 설정", goal: "끝나면 무엇을 할 수 있는가", duration_days: 3,
      wiki_pages: [{ title: "학습 목표", outline: "- 결과물\n- 측정법" }], milestones: ["KPI 정의"] },
    { name: "02 자료 수집", goal: "신뢰할 자료 큐레이션", duration_days: 7,
      wiki_pages: [{ title: "리딩 리스트", outline: "- 1순위\n- 2순위\n- 부가" }], milestones: ["10개 자료"] },
    { name: "03 학습·정리", goal: "주간 챕터 + 노트 + 토론", duration_days: 28,
      wiki_pages: [{ title: "챕터 노트", outline: "- 핵심\n- 의문\n- 적용" }], milestones: ["주간 노트 4회"] },
    { name: "04 적용·산출물", goal: "배운 것을 만들어 검증", duration_days: 14,
      wiki_pages: [{ title: "산출물 기획", outline: "- 무엇을\n- 누구에게" }], milestones: ["MVP 산출물"] },
  ],
  suggested_roles: [
    { role_name: "리더", specialty_tags: ["퍼실리테이션"], why: "운영 + 진행" },
    { role_name: "기록", specialty_tags: ["요약", "글쓰기"], why: "지식 누적" },
  ],
  resources_folders: ["자료", "노트", "토론", "산출물"],
  first_tasks: ["주제 정의 1줄", "리딩 리스트 10개", "주간 모임 시간 확정", "Day1 노트 템플릿", "결과 공개 채널 준비"],
});

const TEMPLATE_APP: TemplateFn = (intent) => ({
  title: intent.slice(0, 60) || "앱/SaaS 개발",
  summary: `${intent} — 기획부터 수익화까지 단계적 구축`,
  category: "테크",
  phases: [
    { name: "01 기획·검증", goal: "문제·해결책·타겟 정의 + 인터뷰 검증", duration_days: 14,
      wiki_pages: [{ title: "PRD 초안", outline: "- 문제 정의\n- 타겟 사용자\n- 핵심 가치" }, { title: "검증 인터뷰", outline: "- 인터뷰 질문\n- 인사이트\n- 의사결정" }],
      milestones: ["PRD v1", "사용자 5명 인터뷰"] },
    { name: "02 MVP 개발", goal: "핵심 기능만 빠르게 구현", duration_days: 28,
      wiki_pages: [{ title: "기술 스택", outline: "- 프론트\n- 백엔드\n- 인프라" }, { title: "MVP 스코프", outline: "- 필수 기능\n- 차후 기능\n- 비전" }],
      milestones: ["MVP 동작", "내부 테스트"] },
    { name: "03 배포·런칭", goal: "스토어/도메인 + 초기 사용자 모집", duration_days: 14,
      wiki_pages: [{ title: "배포 체크리스트", outline: "- CI/CD\n- 모니터링\n- 보안\n- 도메인" }],
      milestones: ["프로덕션 배포", "베타 100명"] },
    { name: "04 그로스", goal: "온보딩·리텐션·바이럴 루프", duration_days: 30,
      wiki_pages: [{ title: "그로스 지표", outline: "- DAU\n- 리텐션\n- 활성 전환" }],
      milestones: ["WAU 500", "리텐션 30%"] },
    { name: "05 수익화", goal: "구독·결제·광고 모델 검증", duration_days: 21,
      wiki_pages: [{ title: "수익 모델", outline: "- 가격 책정\n- 결제 흐름\n- 환불 정책" }],
      milestones: ["첫 매출", "MRR 목표"] },
  ],
  suggested_roles: [
    { role_name: "PM/기획", specialty_tags: ["PRD", "UX"], why: "방향성" },
    { role_name: "프론트엔드", specialty_tags: ["React", "Next.js"], why: "UI" },
    { role_name: "백엔드", specialty_tags: ["API", "DB"], why: "인프라" },
    { role_name: "디자이너", specialty_tags: ["Figma"], why: "사용성" },
    { role_name: "그로스", specialty_tags: ["Analytics"], why: "지표 개선" },
  ],
  resources_folders: ["기획", "디자인", "코드", "배포", "분석"],
  first_tasks: ["문제 한 문장 정리", "타겟 사용자 5명 섭외", "유사 서비스 3개 분석", "MVP 핵심 기능 3개", "기술 스택 결정", "도메인 확보"],
});

const TEMPLATE_BOOK: TemplateFn = (intent) => ({
  title: intent.slice(0, 60) || "책 출판",
  summary: `${intent} — 기획부터 출판·마케팅까지`,
  category: "콘텐츠",
  phases: [
    { name: "01 기획", goal: "주제·타겟·구성 결정", duration_days: 14,
      wiki_pages: [{ title: "출간 기획서", outline: "- 컨셉\n- 타겟 독자\n- 목차\n- 차별점" }],
      milestones: ["기획서 완성", "목차 확정"] },
    { name: "02 집필", goal: "초고 작성", duration_days: 90,
      wiki_pages: [{ title: "집필 캘린더", outline: "- 챕터별 마감\n- 주간 단어수" }, { title: "리서치 노트", outline: "- 출처\n- 인용\n- 사례" }],
      milestones: ["초고 완성"] },
    { name: "03 편집·교정", goal: "구조·문장·사실 검증", duration_days: 30,
      wiki_pages: [{ title: "편집 노트", outline: "- 구조 개선\n- 문장 다듬기\n- 팩트체크" }],
      milestones: ["원고 최종본"] },
    { name: "04 출판", goal: "출판사 또는 자가출판 진행", duration_days: 30,
      wiki_pages: [{ title: "출판 체크리스트", outline: "- 표지\n- ISBN\n- 인쇄\n- 유통" }],
      milestones: ["출간"] },
    { name: "05 마케팅", goal: "북투어·SNS·서평", duration_days: 30,
      wiki_pages: [{ title: "런칭 캠페인", outline: "- 사전예약\n- 북토크\n- 서평단" }],
      milestones: ["1쇄 소진"] },
  ],
  suggested_roles: [
    { role_name: "저자", specialty_tags: ["글쓰기"], why: "본문" },
    { role_name: "편집자", specialty_tags: ["편집"], why: "품질" },
    { role_name: "디자이너", specialty_tags: ["표지"], why: "비주얼" },
    { role_name: "마케터", specialty_tags: ["북마케팅"], why: "유통" },
  ],
  resources_folders: ["기획서", "원고", "리서치", "표지", "마케팅"],
  first_tasks: ["기획안 한 페이지", "목차 초안", "유사 도서 5권 분석", "샘플 챕터 작성", "출판사 리스트업"],
});

const TEMPLATE_EVENT: TemplateFn = (intent) => ({
  title: intent.slice(0, 60) || "행사 운영",
  summary: `${intent} — 컨셉부터 회고까지`,
  category: "행사",
  phases: [
    { name: "01 컨셉", goal: "주제·규모·예산·일정", duration_days: 14,
      wiki_pages: [{ title: "행사 기획서", outline: "- 목적\n- 타겟\n- 규모\n- 예산" }],
      milestones: ["기획서 확정", "예산 승인"] },
    { name: "02 섭외·모집", goal: "연사·스폰서·참가자 확보", duration_days: 30,
      wiki_pages: [{ title: "섭외 리스트", outline: "- 연사 후보\n- 스폰서 후보\n- 컨택 상태" }, { title: "모집 페이지", outline: "- 카피\n- 신청 폼\n- 결제" }],
      milestones: ["연사 확정", "스폰서 확정"] },
    { name: "03 운영 준비", goal: "장소·식음·자료·리허설", duration_days: 21,
      wiki_pages: [{ title: "운영 매뉴얼", outline: "- 진행표\n- 스태프 역할\n- 동선\n- 비상 대응" }],
      milestones: ["리허설 완료"] },
    { name: "04 본 행사", goal: "현장 진행 + 라이브 운영", duration_days: 2,
      wiki_pages: [{ title: "당일 체크리스트", outline: "- 셋업\n- 등록\n- 본 세션\n- 마무리" }],
      milestones: ["행사 종료"] },
    { name: "05 회고", goal: "데이터·후기·정산·차기 기획", duration_days: 14,
      wiki_pages: [{ title: "회고 보고서", outline: "- 참석률\n- 만족도\n- 손익\n- 차기 액션" }],
      milestones: ["보고서 공유"] },
  ],
  suggested_roles: [
    { role_name: "총괄 PM", specialty_tags: ["프로젝트관리"], why: "전체 진행" },
    { role_name: "섭외", specialty_tags: ["커뮤니케이션"], why: "연사·스폰서" },
    { role_name: "운영", specialty_tags: ["현장관리"], why: "당일 진행" },
    { role_name: "마케팅", specialty_tags: ["SNS", "콘텐츠"], why: "참가자 모집" },
  ],
  resources_folders: ["기획", "섭외", "디자인", "운영매뉴얼", "정산"],
  first_tasks: ["행사 한 문장 정의", "예산 윤곽", "후보 장소 5곳", "연사 후보 10명", "킥오프 미팅"],
});

const TEMPLATE_STARTUP: TemplateFn = (intent) => ({
  title: intent.slice(0, 60) || "스타트업 창업",
  summary: `${intent} — 발굴·검증·팀빌딩·펀딩·성장`,
  category: "사업",
  phases: [
    { name: "01 문제 발굴", goal: "고객의 진짜 문제 정의", duration_days: 21,
      wiki_pages: [{ title: "문제 인터뷰", outline: "- 인터뷰 대상\n- 문제 가설\n- 발견점" }],
      milestones: ["문제 정의서"] },
    { name: "02 솔루션 검증", goal: "MVP 또는 LP 로 수요 검증", duration_days: 30,
      wiki_pages: [{ title: "검증 실험", outline: "- 가설\n- 실험 방법\n- 지표" }],
      milestones: ["전환율 확보"] },
    { name: "03 팀빌딩·법인", goal: "공동창업자·법인 설립·계약", duration_days: 30,
      wiki_pages: [{ title: "지분·계약", outline: "- 지분 구조\n- 베스팅\n- 주주간계약" }],
      milestones: ["법인 설립"] },
    { name: "04 펀딩", goal: "엔젤/시드 라운드", duration_days: 60,
      wiki_pages: [{ title: "IR 데크", outline: "- 문제\n- 솔루션\n- 시장\n- 팀\n- 트랙션" }],
      milestones: ["시드 클로징"] },
    { name: "05 성장", goal: "PMF + 채용 + 지표", duration_days: 90,
      wiki_pages: [{ title: "그로스 OKR", outline: "- 분기 목표\n- 핵심 지표\n- 실험" }],
      milestones: ["PMF 신호", "10명 팀"] },
  ],
  suggested_roles: [
    { role_name: "CEO", specialty_tags: ["전략"], why: "비전" },
    { role_name: "CTO", specialty_tags: ["테크"], why: "기술" },
    { role_name: "Growth", specialty_tags: ["마케팅"], why: "지표" },
  ],
  resources_folders: ["인터뷰", "재무", "법무", "IR", "OKR"],
  first_tasks: ["고객 10명 인터뷰", "문제 한 문장 정리", "공동창업자 후보", "법인 설립 절차 확인", "MVP 스코프"],
});

const TEMPLATE_MARKETING: TemplateFn = (intent) => ({
  title: intent.slice(0, 60) || "마케팅 캠페인",
  summary: `${intent} — 전략·크리에이티브·매체·집행·분석`,
  category: "마케팅",
  phases: [
    { name: "01 전략", goal: "목표·타겟·메시지·예산", duration_days: 7,
      wiki_pages: [{ title: "캠페인 브리프", outline: "- 목표 KPI\n- 타겟 오디언스\n- 핵심 메시지\n- 예산" }],
      milestones: ["브리프 확정"] },
    { name: "02 크리에이티브", goal: "카피·비주얼·영상", duration_days: 14,
      wiki_pages: [{ title: "크리에이티브 가이드", outline: "- 톤\n- 비주얼\n- A/B 안" }],
      milestones: ["에셋 완성"] },
    { name: "03 매체 셋업", goal: "채널·픽셀·캠페인 구조", duration_days: 7,
      wiki_pages: [{ title: "매체 플랜", outline: "- 채널 믹스\n- 예산 분배\n- 트래킹" }],
      milestones: ["광고 게시"] },
    { name: "04 집행·최적화", goal: "주간 최적화 + 학습", duration_days: 21,
      wiki_pages: [{ title: "주간 리포트", outline: "- CTR\n- CPC\n- ROAS\n- 인사이트" }],
      milestones: ["KPI 달성"] },
    { name: "05 분석·차기", goal: "최종 분석 + 다음 액션", duration_days: 7,
      wiki_pages: [{ title: "최종 보고서", outline: "- 결과\n- 학습\n- 차기 가설" }],
      milestones: ["회고 공유"] },
  ],
  suggested_roles: [
    { role_name: "마케팅 리드", specialty_tags: ["퍼포먼스"], why: "전략·운영" },
    { role_name: "크리에이터", specialty_tags: ["카피", "디자인"], why: "에셋" },
    { role_name: "데이터", specialty_tags: ["GA", "광고분석"], why: "지표" },
  ],
  resources_folders: ["전략", "크리에이티브", "매체", "리포트"],
  first_tasks: ["KPI 정의", "타겟 페르소나", "유사 캠페인 5개 분석", "브리프 초안", "예산 시뮬"],
});

const TEMPLATE_REALESTATE: TemplateFn = (intent) => ({
  title: intent.slice(0, 60) || "부동산 검토",
  summary: `${intent} — 자료·분석·보고서·협상·매입`,
  category: "부동산",
  phases: [
    { name: "01 자료 수집", goal: "등기·건축물대장·시세·임대 현황", duration_days: 7,
      wiki_pages: [{ title: "물건 카드", outline: "- 주소\n- 면적\n- 용도지역\n- 임차 현황\n- 대출" }],
      milestones: ["서류 완비"] },
    { name: "02 분석", goal: "사업성·리스크·시나리오", duration_days: 7,
      wiki_pages: [{ title: "사업성 분석", outline: "- 매입가\n- 리모델링비\n- 임대수익\n- IRR" }],
      milestones: ["분석 완료"] },
    { name: "03 검토 보고서", goal: "내부/외부 보고서 작성", duration_days: 5,
      wiki_pages: [{ title: "검토서 구조", outline: "- 요약\n- 사업성\n- 리스크\n- 결론" }],
      milestones: ["보고서 발행"] },
    { name: "04 협상·계약", goal: "가격 협상 + 계약서", duration_days: 21,
      wiki_pages: [{ title: "협상 노트", outline: "- 핵심 쟁점\n- 카운터 안\n- 합의안" }],
      milestones: ["계약 체결"] },
    { name: "05 매입·운영", goal: "잔금·등기·운영 인계", duration_days: 30,
      wiki_pages: [{ title: "클로징 체크", outline: "- 잔금\n- 등기\n- 임차인 인계" }],
      milestones: ["소유권 이전"] },
  ],
  suggested_roles: [
    { role_name: "부동산 분석가", specialty_tags: ["감정", "사업성"], why: "수치 검증" },
    { role_name: "법무", specialty_tags: ["계약"], why: "리스크" },
    { role_name: "딜 매니저", specialty_tags: ["협상"], why: "거래 진행" },
  ],
  resources_folders: ["서류", "분석", "보고서", "계약", "사진"],
  first_tasks: ["등기 발급", "건축물대장 확인", "주변 시세 조사", "사업성 모델링", "방문 답사"],
});

const TEMPLATE_CERT: TemplateFn = (intent) => ({
  title: intent.slice(0, 60) || "자격증 합격",
  summary: `${intent} — 진단·계획·실전·모의·응시`,
  category: "학습",
  phases: [
    { name: "01 진단", goal: "현재 수준 + 출제 경향", duration_days: 5,
      wiki_pages: [{ title: "진단 결과", outline: "- 현재 점수\n- 약점 영역\n- 출제 경향" }],
      milestones: ["기출 1회 풀이"] },
    { name: "02 학습 계획", goal: "주차별 커리큘럼", duration_days: 3,
      wiki_pages: [{ title: "학습 캘린더", outline: "- 주차별 단원\n- 일일 분량\n- 복습 사이클" }],
      milestones: ["계획 확정"] },
    { name: "03 실전 학습", goal: "이론 + 단원별 문제", duration_days: 60,
      wiki_pages: [{ title: "오답 노트", outline: "- 문제\n- 정답\n- 풀이\n- 재발 방지" }],
      milestones: ["전체 1회독"] },
    { name: "04 모의고사", goal: "실전 환경 + 시간 관리", duration_days: 14,
      wiki_pages: [{ title: "모의고사 기록", outline: "- 회차별 점수\n- 약점\n- 보강" }],
      milestones: ["합격선 달성"] },
    { name: "05 응시", goal: "당일 컨디션 + 시험", duration_days: 3,
      wiki_pages: [{ title: "당일 체크", outline: "- 준비물\n- 동선\n- 컨디션" }],
      milestones: ["합격"] },
  ],
  suggested_roles: [
    { role_name: "스터디 리더", specialty_tags: ["계획"], why: "운영" },
    { role_name: "교재 큐레이터", specialty_tags: ["자료"], why: "리소스" },
  ],
  resources_folders: ["교재", "기출", "오답노트", "모의고사"],
  first_tasks: ["기출 1회 풀어보기", "교재 1종 결정", "주차별 계획 수립", "스터디 모임 시간", "응시 일정 확인"],
});

const TEMPLATE_FITNESS: TemplateFn = (intent) => ({
  title: intent.slice(0, 60) || "운동 / 마라톤",
  summary: `${intent} — 베이스·강도·시뮬·테이퍼·본대회`,
  category: "건강",
  phases: [
    { name: "01 베이스", goal: "유산소 베이스 + 부상 방지", duration_days: 28,
      wiki_pages: [{ title: "주간 플랜", outline: "- 거리\n- 페이스\n- 휴식" }],
      milestones: ["주간 거리 달성"] },
    { name: "02 강도 훈련", goal: "인터벌·템포·언덕", duration_days: 28,
      wiki_pages: [{ title: "강도 세션", outline: "- 인터벌\n- 템포런\n- 언덕" }],
      milestones: ["페이스 향상"] },
    { name: "03 시뮬레이션", goal: "대회 시간·복장·페이스 점검", duration_days: 14,
      wiki_pages: [{ title: "시뮬런 기록", outline: "- 거리\n- 페이스\n- 보급\n- 컨디션" }],
      milestones: ["하프 시뮬 완주"] },
    { name: "04 테이퍼·회복", goal: "거리 줄이고 컨디션 끌어올림", duration_days: 14,
      wiki_pages: [{ title: "테이퍼 플랜", outline: "- 주간 거리 감소\n- 영양\n- 수면" }],
      milestones: ["컨디션 피크"] },
    { name: "05 본 대회", goal: "레이스 + 회고", duration_days: 3,
      wiki_pages: [{ title: "레이스 데이", outline: "- 준비물\n- 페이스 전략\n- 보급" }],
      milestones: ["완주"] },
  ],
  suggested_roles: [
    { role_name: "코치", specialty_tags: ["트레이닝"], why: "프로그램" },
    { role_name: "동료 러너", specialty_tags: ["페이스"], why: "동기" },
  ],
  resources_folders: ["훈련일지", "기록", "장비", "영양"],
  first_tasks: ["대회 등록", "현재 5K 기록 측정", "주간 플랜 수립", "장비 점검", "부상 이력 정리"],
});

const TEMPLATE_WEDDING: TemplateFn = (intent) => ({
  title: intent.slice(0, 60) || "결혼식 준비",
  summary: `${intent} — 컨셉·예산·베뉴·스드메·본식`,
  category: "실생활",
  phases: [
    { name: "01 컨셉·예산", goal: "스타일·규모·예산 결정", duration_days: 14,
      wiki_pages: [{ title: "컨셉 보드", outline: "- 무드\n- 규모\n- 분위기" }, { title: "예산표", outline: "- 항목별 예산\n- 양가 분담\n- 예비비" }],
      milestones: ["예산 확정"] },
    { name: "02 베뉴·날짜", goal: "예식장 답사·계약", duration_days: 30,
      wiki_pages: [{ title: "베뉴 비교", outline: "- 후보지\n- 식대\n- 보증인원\n- 옵션" }],
      milestones: ["베뉴 계약"] },
    { name: "03 스드메·디테일", goal: "스튜디오·드레스·메이크업 + 청첩장", duration_days: 60,
      wiki_pages: [{ title: "스드메 노트", outline: "- 스튜디오\n- 드레스샵\n- 메이크업\n- 가격" }, { title: "청첩장·답례품", outline: "- 디자인\n- 발송\n- 답례품" }],
      milestones: ["촬영 완료", "청첩장 발송"] },
    { name: "04 D-30 점검", goal: "리허설·하객·동선", duration_days: 30,
      wiki_pages: [{ title: "D-30 체크", outline: "- 하객 인원\n- 동선\n- 식순\n- 사회·축가" }],
      milestones: ["리허설 완료"] },
    { name: "05 본식·정리", goal: "당일 + 인사·정산", duration_days: 14,
      wiki_pages: [{ title: "당일 일정", outline: "- 메이크업\n- 본식\n- 사진\n- 마무리" }],
      milestones: ["본식", "정산"] },
  ],
  suggested_roles: [
    { role_name: "신부·신랑", specialty_tags: ["의사결정"], why: "주체" },
    { role_name: "웨딩 플래너", specialty_tags: ["조율"], why: "총괄" },
    { role_name: "사회·축가", specialty_tags: ["진행"], why: "본식 운영" },
  ],
  resources_folders: ["컨셉", "예산", "베뉴", "스드메", "청첩장"],
  first_tasks: ["예산 한도 합의", "베뉴 후보 5곳", "스드메 패키지 비교", "양가 상견례 일정", "예식 날짜 후보"],
});

const TEMPLATE_TRAVEL: TemplateFn = (intent) => ({
  title: intent.slice(0, 60) || "여행 기획",
  summary: `${intent} — 목적지·일정·예약·짐·여행·회고`,
  category: "실생활",
  phases: [
    { name: "01 목적지·예산", goal: "어디로·언제·얼마", duration_days: 7,
      wiki_pages: [{ title: "여행 컨셉", outline: "- 테마\n- 인원\n- 예산\n- 기간" }],
      milestones: ["목적지 확정"] },
    { name: "02 일정·동선", goal: "날짜별 코스 + 이동", duration_days: 7,
      wiki_pages: [{ title: "일정표", outline: "- Day1~N\n- 이동\n- 식사\n- 활동" }],
      milestones: ["일정 확정"] },
    { name: "03 예약", goal: "항공·숙소·액티비티", duration_days: 14,
      wiki_pages: [{ title: "예약 리스트", outline: "- 항공\n- 숙소\n- 투어\n- 렌터카" }],
      milestones: ["주요 예약 완료"] },
    { name: "04 짐·체크리스트", goal: "준비물 + 비상 대응", duration_days: 7,
      wiki_pages: [{ title: "패킹 리스트", outline: "- 의류\n- 전자기기\n- 약\n- 서류" }],
      milestones: ["짐 완성"] },
    { name: "05 여행·회고", goal: "여행 + 사진·기록 정리", duration_days: 14,
      wiki_pages: [{ title: "여행 일지", outline: "- 하이라이트\n- 사진\n- 다음 여행" }],
      milestones: ["귀국", "사진 정리"] },
  ],
  suggested_roles: [
    { role_name: "기획자", specialty_tags: ["일정"], why: "코스" },
    { role_name: "예약 담당", specialty_tags: ["검색", "비교"], why: "예약" },
  ],
  resources_folders: ["기획", "예약", "지도", "사진", "기록"],
  first_tasks: ["여행 기간 확정", "1인당 예산 합의", "후보 도시 3곳", "비행 시간대 비교", "비자 확인"],
});

const TEMPLATE_PRODUCT: TemplateFn = (intent) => ({
  title: intent.slice(0, 60) || "제품 기획·제조",
  summary: `${intent} — 컨셉·설계·시제품·테스트·양산`,
  category: "제조",
  phases: [
    { name: "01 컨셉", goal: "타겟·문제·차별점·가격대", duration_days: 14,
      wiki_pages: [{ title: "제품 브리프", outline: "- 타겟\n- USP\n- 가격대\n- 경쟁군" }],
      milestones: ["브리프 확정"] },
    { name: "02 설계", goal: "도면·소재·BOM", duration_days: 30,
      wiki_pages: [{ title: "BOM", outline: "- 부품\n- 소재\n- 단가\n- 협력사" }],
      milestones: ["도면 v1"] },
    { name: "03 시제품", goal: "프로토타입 + 사용성 테스트", duration_days: 30,
      wiki_pages: [{ title: "프로토 결과", outline: "- 외관\n- 기능\n- 개선점" }],
      milestones: ["3차 시제품"] },
    { name: "04 테스트·인증", goal: "안전·내구·인증", duration_days: 30,
      wiki_pages: [{ title: "테스트 리포트", outline: "- 시험 항목\n- 결과\n- 인증" }],
      milestones: ["인증 통과"] },
    { name: "05 양산·유통", goal: "양산 + 판매 채널", duration_days: 60,
      wiki_pages: [{ title: "양산 플랜", outline: "- 수량\n- 단가\n- 리드타임\n- 채널" }],
      milestones: ["1차 양산", "판매 시작"] },
  ],
  suggested_roles: [
    { role_name: "제품 기획", specialty_tags: ["PD"], why: "컨셉" },
    { role_name: "디자이너", specialty_tags: ["산업디자인"], why: "외관" },
    { role_name: "엔지니어", specialty_tags: ["설계"], why: "기능" },
    { role_name: "구매·생산", specialty_tags: ["BOM"], why: "양산" },
  ],
  resources_folders: ["기획", "도면", "BOM", "테스트", "양산"],
  first_tasks: ["타겟 페르소나", "경쟁 제품 5개 분석", "초기 스케치", "BOM 초안", "협력사 후보 3곳"],
});

const TEMPLATE_RESEARCH: TemplateFn = (intent) => ({
  title: intent.slice(0, 60) || "리서치 / 인터뷰",
  summary: `${intent} — 가설·모집·인터뷰·분석·인사이트`,
  category: "리서치",
  phases: [
    { name: "01 가설 정의", goal: "리서치 질문 + 가설", duration_days: 5,
      wiki_pages: [{ title: "리서치 프롬프트", outline: "- 핵심 질문\n- 가설\n- 결과 활용" }],
      milestones: ["가설 확정"] },
    { name: "02 모집", goal: "타겟 섭외 + 일정", duration_days: 14,
      wiki_pages: [{ title: "참여자 풀", outline: "- 스크리너\n- 보상\n- 일정" }],
      milestones: ["참여자 확보"] },
    { name: "03 인터뷰·관찰", goal: "라이브 세션 + 기록", duration_days: 21,
      wiki_pages: [{ title: "인터뷰 가이드", outline: "- 도입\n- 핵심 질문\n- 마무리" }, { title: "세션 노트", outline: "- 발화\n- 행동\n- 인용" }],
      milestones: ["N명 인터뷰 완료"] },
    { name: "04 분석", goal: "테마·패턴 추출", duration_days: 14,
      wiki_pages: [{ title: "분석 보드", outline: "- 인용\n- 테마\n- 빈도" }],
      milestones: ["테마 합의"] },
    { name: "05 인사이트·전달", goal: "보고서 + 워크샵", duration_days: 7,
      wiki_pages: [{ title: "리서치 리포트", outline: "- 요약\n- 핵심 발견\n- 권고\n- 다음 단계" }],
      milestones: ["리포트 공유"] },
  ],
  suggested_roles: [
    { role_name: "리드 리서처", specialty_tags: ["UX리서치"], why: "설계" },
    { role_name: "노트테이커", specialty_tags: ["기록"], why: "분석 자료" },
  ],
  resources_folders: ["가설", "스크립트", "녹취", "분석", "리포트"],
  first_tasks: ["리서치 질문 1줄", "참여자 스크리너", "인터뷰 가이드 v1", "보상 정책", "녹화 동의 양식"],
});

const TEMPLATE_FUNDING: TemplateFn = (intent) => ({
  title: intent.slice(0, 60) || "투자유치 / 펀딩",
  summary: `${intent} — 데크·타겟·IR·실사·클로징`,
  category: "금융",
  phases: [
    { name: "01 데크·자료", goal: "IR 자료·재무모델", duration_days: 14,
      wiki_pages: [{ title: "IR 데크", outline: "- 문제\n- 솔루션\n- 시장\n- 트랙션\n- 팀\n- Ask" }, { title: "재무 모델", outline: "- 5y P&L\n- 가정\n- 시나리오" }],
      milestones: ["데크 v1"] },
    { name: "02 타겟·아웃리치", goal: "투자자 리스트 + 컨택", duration_days: 14,
      wiki_pages: [{ title: "VC 리스트", outline: "- 펀드\n- 사이즈\n- 투자영역\n- 컨택" }],
      milestones: ["20곳 컨택"] },
    { name: "03 IR 미팅", goal: "1차/2차 미팅 + Q&A", duration_days: 30,
      wiki_pages: [{ title: "Q&A 노트", outline: "- 자주 묻는 질문\n- 답변\n- 보강 자료" }],
      milestones: ["LOI 또는 텀시트"] },
    { name: "04 실사", goal: "법무·회계·사업 실사 대응", duration_days: 30,
      wiki_pages: [{ title: "실사 자료실", outline: "- 법인서류\n- 계약\n- 재무\n- 인사" }],
      milestones: ["실사 통과"] },
    { name: "05 클로징", goal: "계약 + 입금 + 공시", duration_days: 14,
      wiki_pages: [{ title: "클로징 체크", outline: "- 주식인수\n- 등기\n- 공시" }],
      milestones: ["입금 완료"] },
  ],
  suggested_roles: [
    { role_name: "CEO", specialty_tags: ["IR"], why: "발표" },
    { role_name: "CFO", specialty_tags: ["재무"], why: "모델·실사" },
    { role_name: "법무", specialty_tags: ["계약"], why: "텀시트" },
  ],
  resources_folders: ["데크", "재무모델", "VC리스트", "실사자료", "계약"],
  first_tasks: ["IR 데크 v0", "재무 모델 시트", "투자자 30명 리스트", "한 줄 피치", "트랙션 자료 정리"],
});

const TEMPLATE_GENERAL: TemplateFn = (intent, kind) => ({
  title: intent.slice(0, 60) || "새 공간",
  summary: `${intent} — 단계별 실행 로드맵`,
  category: "일반",
  phases: [
    { name: "01 정의", goal: "목표·범위·성공 기준 명확화", duration_days: 5,
      wiki_pages: [{ title: "프로젝트 정의서", outline: "- 목표\n- 범위\n- 성공 지표" }], milestones: ["정의서 확정"] },
    { name: "02 기획", goal: "실행 가능한 계획 수립", duration_days: 10,
      wiki_pages: [{ title: "실행 계획", outline: "- 마일스톤\n- 역할\n- 리스크" }], milestones: ["기획안 완료"] },
    { name: "03 실행", goal: "기획대로 진행하며 주간 점검", duration_days: 30,
      wiki_pages: [{ title: "주간 보고", outline: "- 한 일\n- 막힌 곳\n- 다음 주" }], milestones: ["중간 점검"] },
    { name: "04 마무리", goal: "결과 정리 + 회고", duration_days: 7,
      wiki_pages: [{ title: "회고", outline: "- 잘된 점\n- 아쉬운 점\n- 다음" }], milestones: ["최종 발표"] },
  ],
  suggested_roles: [
    { role_name: kind === "project" ? "프로젝트 리드" : "호스트", specialty_tags: ["관리"], why: "전체 진행" },
    { role_name: "실무 담당", specialty_tags: ["실행"], why: "산출물 작성" },
  ],
  resources_folders: ["기획", "실행", "산출물", "회고"],
  first_tasks: ["목표 1줄 정리", "이해관계자 파악", "킥오프 미팅 일정", "역할 분담", "첫 주 할 일 3가지"],
});

// ── 템플릿 레지스트리 (점수 기반 매칭) ──────────────────────

const TEMPLATES: TemplateEntry[] = [
  {
    key: "youtube",
    keywords: [
      ["유튜브", "youtube", "채널", "영상", "비디오", "video"],
      ["콘텐츠", "발행", "구독", "촬영", "편집"],
    ],
    build: TEMPLATE_YOUTUBE,
  },
  {
    key: "cafe",
    keywords: [
      ["카페", "매장", "오프라인", "쇼룸", "팝업스토어", "레스토랑", "음식점", "공방"],
      ["오픈", "운영", "임대", "인테리어", "메뉴"],
    ],
    build: TEMPLATE_CAFE,
  },
  {
    key: "study",
    keywords: [
      ["스터디", "공부", "학습", "독서", "강의수강", "북클럽"],
      ["주제", "리딩", "토론", "노트"],
    ],
    build: TEMPLATE_STUDY,
  },
  {
    key: "app",
    keywords: [
      ["앱", "app", "saas", "플랫폼", "웹서비스", "서비스개발", "프로덕트", "product", "ai 모델", "오픈소스"],
      ["개발", "런칭", "출시", "mvp", "개발자"],
    ],
    build: TEMPLATE_APP,
  },
  {
    key: "book",
    keywords: [
      ["책", "출판", "출간", "도서", "에세이", "소설", "전자책", "ebook"],
      ["집필", "원고", "저자", "편집", "출판사"],
    ],
    build: TEMPLATE_BOOK,
  },
  {
    key: "event",
    keywords: [
      ["컨퍼런스", "행사", "이벤트", "페스티벌", "팝업", "전시", "워크숍", "워크샵", "세미나", "포럼", "박람회"],
      ["연사", "스폰서", "참가자", "운영", "리허설"],
    ],
    build: TEMPLATE_EVENT,
  },
  {
    key: "startup",
    keywords: [
      ["창업", "스타트업", "startup", "사업시작", "법인설립"],
      ["mvp", "팀빌딩", "공동창업", "검증"],
    ],
    build: TEMPLATE_STARTUP,
  },
  {
    key: "marketing",
    keywords: [
      ["마케팅", "캠페인", "광고", "ads", "브랜딩", "seo", "퍼포먼스", "프로모션", "pr", "홍보"],
      ["타겟", "전환", "ctr", "roas", "매체"],
    ],
    build: TEMPLATE_MARKETING,
  },
  {
    key: "realestate",
    keywords: [
      ["부동산", "lh", "매입임대", "매입", "임장", "빌라", "오피스텔", "다가구", "다세대", "시행", "토지"],
      ["감정가", "용도지역", "임차", "등기", "매도"],
    ],
    build: TEMPLATE_REALESTATE,
  },
  {
    key: "cert",
    keywords: [
      ["자격증", "시험", "고시", "공무원", "토익", "toeic", "ielts", "opic", "한능검"],
      ["기출", "모의고사", "합격", "응시"],
    ],
    build: TEMPLATE_CERT,
  },
  {
    key: "fitness",
    keywords: [
      ["운동", "피트니스", "헬스", "트레이닝", "마라톤", "러닝", "다이어트", "감량", "체중", "근력", "요가", "필라테스", "수영", "사이클"],
      ["주간", "세트", "페이스", "체지방", "식단"],
    ],
    build: TEMPLATE_FITNESS,
  },
  {
    key: "wedding",
    keywords: [
      ["결혼", "결혼식", "웨딩", "예식", "스드메", "신혼"],
      ["베뉴", "신부", "신랑", "청첩장", "예단"],
    ],
    build: TEMPLATE_WEDDING,
  },
  {
    key: "travel",
    keywords: [
      ["여행", "여행기획", "휴가", "trip", "vacation", "백패킹", "배낭"],
      ["항공", "숙소", "일정", "비자", "투어"],
    ],
    build: TEMPLATE_TRAVEL,
  },
  {
    key: "product",
    keywords: [
      ["제품", "프로덕트", "제조", "굿즈", "하드웨어", "양산", "시제품", "프로토타입"],
      ["bom", "도면", "공장", "협력사", "설계"],
    ],
    build: TEMPLATE_PRODUCT,
  },
  {
    key: "research",
    keywords: [
      ["리서치", "research", "인터뷰", "interview", "ux리서치", "사용자조사", "시장조사", "논문", "설문"],
      ["가설", "참여자", "분석", "인사이트"],
    ],
    build: TEMPLATE_RESEARCH,
  },
  {
    key: "funding",
    keywords: [
      ["투자유치", "ir", "펀딩", "투자자", "vc", "엔젤", "시드", "라운드"],
      ["데크", "텀시트", "실사", "클로징"],
    ],
    build: TEMPLATE_FUNDING,
  },
];
