import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/seed-tap-products
 * Admin 전용 — ZeroSite/Flagtale/SecondWind 의 템플릿을 탭 스토어에 시드.
 * 실제 본문은 DB 에 들어가고, seller_id 는 호출한 admin 또는 body.sellerId.
 */

const SEED_PRODUCTS = [
  {
    slug: "lh-social-housing-review",
    title: "LH 사회주택 공급모델 분석 템플릿",
    summary: "LH 공공주택 검토보고서 작성에 필요한 구조·지표·체크리스트 묶음. ZeroSite 실전 프로젝트 기반.",
    product_type: "template",
    price: 89000,
    tags: ["LH", "사회주택", "공공주택", "PropTech", "검토보고서"],
    cover_url: null,
    preview_md: `# LH 사회주택 공급모델 분석 템플릿 — 미리보기

## 목차
1. 공급유형 분류 (행복주택/국민임대/공공임대/매입임대/전세임대)
2. 대지조건 체크리스트 (16개 항목)
3. 세대수·주차·면적 산출 공식
4. 사업성 지표 (IRR, PBT, 공사비/세대)
5. 리스크 플래그 (19개)

## 샘플 섹션 — 2. 대지조건 체크리스트

- [ ] 용도지역 · 건축선 확인
- [ ] 지구단위계획 저촉 여부
- [ ] 도로 폭 4m 이상 확보
- [ ] 진입로 경사 1/8 이하
- [ ] 주차장 설치기준 (세대당 0.6대)
...

## 이 템플릿이 해결하는 문제
LH 공급모델을 처음 접하는 실무자가 **2주 걸릴 기초 조사를 반나절**에 끝낼 수 있도록, ZeroSite 가 축적한 19개 프로젝트의 실전 체크리스트를 구조화했습니다.`,
    full_content_md: `# LH 사회주택 공급모델 분석 템플릿 v2.0

> _이 템플릿은 ZeroSite 에서 2022-2024 사이 수행한 19건의 LH 공급 검토 프로젝트를 바탕으로 구조화한 것입니다._

## 1. 공급유형 분류

### 1-1. 행복주택
- 대상: 청년/신혼부부/고령자
- 임대기간: 최대 30년
- 임대료: 시세 60-80%

### 1-2. 국민임대
- 대상: 저소득층 (소득 4분위 이하)
- 임대기간: 50년
- 임대료: 시세 50-70%

_(중략 — 실제 상품에는 5개 유형 전체 상세)_

## 2. 대지조건 체크리스트 (전 16개)

### 법정 요건
- [ ] 용도지역 · 건축선 확인
- [ ] 지구단위계획 저촉 여부
- [ ] 도로 폭 4m 이상 확보
- [ ] 진입로 경사 1/8 이하
- [ ] 주차장 설치기준 (세대당 0.6대)
- [ ] 건폐율 60% 이하
- [ ] 용적률 200% 이하 (지역별 상이)
- [ ] 일조권 사선 제한 (3m + 2H)

### 실무 요건
- [ ] 지하수·지질 조사
- [ ] 전기 인입 거리
- [ ] 하수·도시가스 인입 가능
- [ ] 소방 진입로
- [ ] 학교시설용지 부담금 (500세대 이상)
- [ ] 기부채납 부지 비율
- [ ] 공원·녹지 (1세대당 3m²)
- [ ] 주변 기피시설 영향

## 3. 세대수·주차·면적 산출 공식

\`\`\`
가능 세대수 = 대지면적 × 용적률 / 전용면적당 계수
전용면적당 계수:
  - 원룸형 24m²: 32
  - 투룸형 36m²: 45
  - 쓰리룸형 59m²: 72
\`\`\`

## 4. 사업성 지표

- **IRR**: 할인율 8% 기준 > 9% 권장
- **PBT (Payback Time)**: 25년 이내
- **공사비/세대**: 원룸 1.8억 / 투룸 2.4억 / 쓰리룸 3.1억 (2024년 기준)

## 5. 리스크 플래그

_(중략 — 실제 상품에는 19개 리스크 전체)_

---

## 부록 — 체크리스트 Notion 링크
첨부된 파일의 Notion 템플릿을 복제하여 바로 사용할 수 있습니다.`,
    attached_files: [
      { name: "LH-checklist-v2.notion.md", url: "https://www.notion.so/nutunion/lh-checklist-v2" },
      { name: "site-analysis-calculator.xlsx", url: "https://docs.google.com/spreadsheets/d/example" },
    ],
  },
  {
    slug: "flagtale-space-ops",
    title: "공간 운영 매뉴얼 — Flagtale 3년 축적본",
    summary: "오프라인 공간을 6개월 이상 운영한 실무자가 알아야 할 모든 것. 가드닝 원칙 · 예약 시스템 · 운영 KPI.",
    product_type: "ebook",
    price: 29000,
    tags: ["공간운영", "F&B", "팝업", "OS", "Flagtale"],
    preview_md: `# 공간 운영 매뉴얼 — 미리보기

## 목차
1. 공간 설계의 "OS 레이어" 개념
2. 가드닝 원칙 5가지
3. 월간 운영 KPI 대시보드
4. 이벤트 기획 템플릿
5. 위기 관리 체크리스트

## 샘플 — 2. 가드닝 원칙 5가지
공간은 정원처럼 "계속 가꿔야" 합니다. 운영 3년간 시행착오로 얻은 원칙:

1. **1주일 룰**: 새 디스플레이 1주일 내 반응 없으면 철거
2. **30% 비움**: 공간의 30%는 의도적으로 비워둔다
...`,
    full_content_md: `# 공간 운영 매뉴얼 v1.2 — Flagtale 3년 축적본\n\n_(전체 매뉴얼 본문 — 약 80페이지 분량)_`,
    attached_files: [
      { name: "flagtale-ops-playbook.pdf", url: "https://drive.google.com/example-flagtale" },
    ],
  },
  {
    slug: "secondwind-running-guide",
    title: "SecondWind 러닝 프로그램 12주 가이드",
    summary: "도시에서 지속 가능한 러닝 습관을 만드는 12주 커리큘럼. 페이스·회복·동료 시스템 설계.",
    product_type: "course",
    price: 49000,
    tags: ["러닝", "건강", "커뮤니티", "습관", "SecondWind"],
    preview_md: `# SecondWind 12주 러닝 가이드 — 미리보기

## 왜 12주인가?
- 4주: 몸이 적응
- 8주: 습관이 된다
- 12주: 동료가 생긴다

## Week 1 샘플

### 목표
- 주 3회 / 회당 20분
- 대화 가능한 페이스 (8-9분/km)

### 루틴
월 — Easy Run 20분
수 — Core 홈트 + 10분 조깅
토 — 커뮤니티 러닝 (선택)
...`,
    full_content_md: `# SecondWind 12주 러닝 가이드 — 전체\n\n_(12주 전체 커리큘럼 + 주간 로그 템플릿 + 팟캐스트 링크)_`,
    attached_files: [
      { name: "week-tracker.pdf", url: "https://drive.google.com/example-secondwind" },
    ],
  },
];

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const sellerId = body.sellerId || user.id;
  const publish = body.publish === true;

  const results = [];
  for (const s of SEED_PRODUCTS) {
    // 중복 방지: 같은 제목으로 이미 있는지
    const { data: existing } = await supabase
      .from("tap_products")
      .select("id")
      .eq("title", s.title)
      .eq("seller_id", sellerId)
      .maybeSingle();
    if (existing) {
      results.push({ title: s.title, status: "skipped_existing", id: existing.id });
      continue;
    }

    const { data, error } = await supabase.from("tap_products").insert({
      seller_id: sellerId,
      title: s.title,
      summary: s.summary,
      product_type: s.product_type,
      price: s.price,
      currency: "KRW",
      cover_url: s.cover_url,
      preview_md: s.preview_md,
      full_content_md: s.full_content_md,
      tags: s.tags,
      attached_files: s.attached_files,
      status: publish ? "published" : "draft",
    }).select("id").single();

    if (error) results.push({ title: s.title, status: "error", error: error.message });
    else results.push({ title: s.title, status: "created", id: data.id });
  }

  return NextResponse.json({ sellerId, total: SEED_PRODUCTS.length, results });
}
