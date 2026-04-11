import { notFound } from "next/navigation";
import Link from "next/link";
import { FileText, ArrowLeft, Download, Copy } from "lucide-react";

// ── Template content definitions ──
const templates: Record<string, {
  title: string;
  category: string;
  description: string;
  content: string;
}> = {
  /* ====== Group Templates ====== */
  "sprint-guide": {
    title: "Sprint 운영 가이드",
    category: "소모임",
    description: "6주 스프린트 소모임을 효과적으로 운영하기 위한 가이드입니다.",
    content: `# Sprint 운영 가이드

## 1. 스프린트 개요
- 기간: 6주 (Week 1 ~ Week 6)
- 미팅: 매주 1회, 60분
- 목표: 명확한 아웃풋 도출

## 2. 주차별 운영 플로우

### Week 1: 기획 (Planning)
- 팀 소개 및 아이스브레이킹 (10분)
- 프로젝트 목표 설정 (20분)
- 역할 분담 및 R&R 합의 (15분)
- 첫 주 액션 아이템 정리 (15분)

### Week 2: 실행 1차 (Sprint 1)
- 지난주 액션 아이템 점검 (10분)
- 개인별 진행 상황 공유 (20분)
- 블로커 논의 및 해결 (15분)
- 다음 주 목표 재설정 (15분)

### Week 3: 중간점검 (Mid Review)
- 전체 진행률 체크 (15분)
- 피봇 필요 여부 논의 (15분)
- 외부 피드백 공유 (15분)
- 후반부 계획 수립 (15분)

### Week 4: 실행 2차 (Sprint 2)
- 집중 작업 결과 공유 (20분)
- 상호 코드/디자인 리뷰 (20분)
- 다음 주 마감 일정 확인 (10분)
- Q&A (10분)

### Week 5: 마무리 (Finalization)
- 최종 아웃풋 검토 (25분)
- 수정사항 정리 (15분)
- 발표 자료 준비 (10분)
- 리허설 (10분)

### Week 6: 회고 (Retrospective)
- 최종 발표/시연 (20분)
- KPT 회고 (20분)
  - Keep: 잘한 점
  - Problem: 아쉬운 점
  - Try: 다음에 시도할 것
- 후속 계획 논의 (10분)
- 마무리 (10분)

## 3. 미팅 운영 팁
- 타임키퍼 지정: 각 안건별 시간 엄수
- 서기 돌아가며 하기: 회의록 작성 분담
- 액션 아이템: 반드시 담당자 + 마감일 지정
- 사전 준비: 미팅 전날까지 진행 상황 공유

## 4. 필수 도구
- 소통: 카카오톡/슬랙 그룹챗
- 문서: Google Docs 공유 폴더
- 일정: NutUnion 소모임 캘린더
- 칸반: 마일스톤 & 태스크 보드

## 5. 성과 측정
- 주간 완료 태스크 수
- 마일스톤 달성률
- 팀원 참여도 (미팅 출석률)
- 최종 아웃풋 완성도`,
  },

  "meeting-notes": {
    title: "회의록 양식",
    category: "소모임",
    description: "소모임/프로젝트 미팅 시 활용할 수 있는 표준 회의록 양식입니다.",
    content: `# 회의록 양식

## 회의 정보
| 항목 | 내용 |
|------|------|
| 일시 | 2026년 __월 __일 (__)  __:__ ~ __:__ |
| 장소 | |
| 참석자 | |
| 서기 | |
| 진행자 | |

---

## 안건 (Agenda)

### 안건 1: [제목]
**발표자:**
**소요시간:** 분

**내용:**
-

**논의 사항:**
-

**결정 사항:**
-

---

### 안건 2: [제목]
**발표자:**
**소요시간:** 분

**내용:**
-

**논의 사항:**
-

**결정 사항:**
-

---

## 액션 아이템 (Action Items)

| No. | 내용 | 담당자 | 마감일 | 상태 |
|-----|------|--------|--------|------|
| 1 | | | | ⬜ |
| 2 | | | | ⬜ |
| 3 | | | | ⬜ |

---

## 다음 미팅
- 일시:
- 장소:
- 주요 안건:

---

## 기타 메모
- `,
  },

  "paper-selection-guide": {
    title: "논문 선정 가이드",
    category: "소모임",
    description: "논문 리뷰 소모임에서 논문을 선정할 때 참고할 가이드입니다.",
    content: `# 논문 선정 가이드

## 1. 논문 선정 기준

### 필수 조건
- 최근 3년 이내 발표된 논문 우선
- 팀원 전원이 읽을 수 있는 분량 (15페이지 이내 권장)
- 주제가 소모임 목표와 관련 있을 것

### 우선 선정 기준
- 인용 수 50회 이상
- Top-tier 학회/저널 게재
- 실무 적용 가능성이 있는 연구
- 코드/데이터가 공개된 논문

## 2. 논문 검색 방법

### 추천 플랫폼
- Google Scholar (scholar.google.com)
- arXiv (arxiv.org) — 프리프린트
- Semantic Scholar (semanticscholar.org)
- Papers With Code (paperswithcode.com)

### 검색 팁
- 키워드 조합: "[주제] + survey" 로 서베이 논문 먼저 파악
- Connected Papers 활용하여 관련 논문 맵 탐색
- 유명 연구자의 최신 논문 추적

## 3. 논문 리뷰 양식

### 기본 정보
- 논문 제목:
- 저자:
- 학회/저널:
- 발표 연도:
- 링크:

### 리뷰 내용
1. **한줄 요약**: 이 논문은 _____를 제안/발견했다.
2. **문제 정의**: 어떤 문제를 풀려고 하는가?
3. **기존 방법의 한계**: 왜 새로운 접근이 필요한가?
4. **제안 방법**: 핵심 아이디어는 무엇인가?
5. **실험 결과**: 주요 결과와 수치
6. **강점**: 이 논문의 기여/장점
7. **약점**: 한계점/개선 가능한 부분
8. **실무 적용**: 우리 프로젝트에 어떻게 적용 가능한가?

## 4. 발표 가이드
- 발표 시간: 15~20분
- 질의응답: 10~15분
- 슬라이드 구성: 10장 내외 권장
- 핵심 Figure/Table 반드시 포함`,
  },

  "business-model-canvas": {
    title: "Business Model Canvas 양식",
    category: "소모임",
    description: "비즈니스 모델을 체계적으로 정리할 수 있는 BMC 양식입니다.",
    content: `# Business Model Canvas

## 프로젝트명: [이름]
## 작성일: 2026년 __월 __일
## 작성자:

---

## 1. 고객 세그먼트 (Customer Segments)
> 누구를 위해 가치를 창출하는가? 가장 중요한 고객은 누구인가?

- 주요 타겟:
- 세부 세그먼트:
- 페르소나:

## 2. 가치 제안 (Value Propositions)
> 고객에게 어떤 가치를 전달하는가? 어떤 문제를 해결해주는가?

- 핵심 가치:
- 차별점:
- 고객 Pain Point:

## 3. 채널 (Channels)
> 고객에게 어떻게 도달하는가?

- 인지 단계:
- 평가 단계:
- 구매 단계:
- 전달 단계:
- 사후 관리:

## 4. 고객 관계 (Customer Relationships)
> 각 고객 세그먼트와 어떤 유형의 관계를 맺는가?

- 관계 유형:
- 고객 유지 전략:
- 커뮤니티:

## 5. 수익원 (Revenue Streams)
> 고객이 어떤 가치에 기꺼이 돈을 지불하는가?

- 주요 수익 모델:
- 가격 정책:
- 예상 매출:

## 6. 핵심 자원 (Key Resources)
> 비즈니스 모델을 운영하기 위해 필요한 핵심 자원은?

- 물적 자원:
- 지적 자원:
- 인적 자원:
- 재무 자원:

## 7. 핵심 활동 (Key Activities)
> 비즈니스 모델을 실행하기 위해 해야 할 가장 중요한 일은?

- 생산:
- 문제 해결:
- 플랫폼/네트워크:

## 8. 핵심 파트너십 (Key Partnerships)
> 누구와 협력해야 하는가?

- 전략적 제휴:
- 공급자:
- 협업 파트너:

## 9. 비용 구조 (Cost Structure)
> 비즈니스 모델에서 가장 중요한 비용은?

- 고정비:
- 변동비:
- 규모의 경제:

---

## 검증 계획
| 가설 | 검증 방법 | 성공 기준 | 기한 |
|------|-----------|-----------|------|
| | | | |
| | | | |`,
  },

  "market-research": {
    title: "시장조사 체크리스트",
    category: "소모임",
    description: "창업/벤처 소모임에서 시장조사를 체계적으로 진행하기 위한 체크리스트입니다.",
    content: `# 시장조사 체크리스트

## 1. 시장 규모 (Market Size)

### TAM (Total Addressable Market)
- [ ] 전체 시장 규모 산출
- [ ] 출처:
- [ ] 금액:

### SAM (Serviceable Addressable Market)
- [ ] 실제 도달 가능한 시장 범위
- [ ] 금액:

### SOM (Serviceable Obtainable Market)
- [ ] 현실적으로 획득 가능한 시장
- [ ] 금액:

## 2. 경쟁사 분석

### 직접 경쟁사
| 경쟁사명 | 주요 제품 | 강점 | 약점 | 시장 점유율 |
|----------|----------|------|------|-----------|
| | | | | |
| | | | | |

### 간접 경쟁사
| 경쟁사명 | 대체 서비스 | 우리와의 차이 |
|----------|-----------|-------------|
| | | |

## 3. 고객 조사

### 인터뷰 계획
- [ ] 타겟 인터뷰 대상 선정 (최소 10명)
- [ ] 인터뷰 질문지 작성
- [ ] 인터뷰 일정 수립
- [ ] 인터뷰 결과 정리

### 설문조사
- [ ] 설문 문항 설계
- [ ] 배포 채널 확보
- [ ] 최소 응답 수 목표: __명
- [ ] 결과 분석

## 4. 트렌드 분석
- [ ] 네이버 데이터랩 키워드 트렌드
- [ ] Google Trends 확인
- [ ] 관련 뉴스 최근 3개월 모니터링
- [ ] SNS 언급량 분석

## 5. 규제 및 법적 환경
- [ ] 관련 법규 확인
- [ ] 인허가 요건 확인
- [ ] 개인정보보호법 검토
- [ ] 세금/회계 이슈

## 6. 결론 및 인사이트
### 기회 (Opportunities)
-

### 위협 (Threats)
-

### 핵심 인사이트
-

### 다음 단계
- `,
  },

  /* ====== Project Templates ====== */
  "brand-guideline": {
    title: "브랜드 가이드라인 양식",
    category: "프로젝트",
    description: "로컬 브랜딩 프로젝트에서 브랜드 아이덴티티를 정리하는 가이드라인 양식입니다.",
    content: `# 브랜드 가이드라인

## 1. 브랜드 개요
### 브랜드명
- 한글:
- 영문:
- 약칭:

### 브랜드 미션
>

### 브랜드 비전
>

### 브랜드 핵심 가치
1.
2.
3.

## 2. 로고 가이드라인
### 기본 로고
- 가로형:
- 세로형:
- 심볼:

### 사용 규정
- 최소 크기: px 이상
- 여백 규정: 로고 높이의 1/2 이상
- 금지 사항: 변형, 회전, 그라데이션 적용 불가

## 3. 컬러 시스템
### Primary Colors
| 용도 | 색상명 | HEX | RGB |
|------|--------|-----|-----|
| 주요 | | | |
| 보조 | | | |

### Secondary Colors
| 용도 | 색상명 | HEX | RGB |
|------|--------|-----|-----|
| 강조 | | | |
| 배경 | | | |

## 4. 타이포그래피
### 국문 서체
- 제목:
- 본문:
- 캡션:

### 영문 서체
- Heading:
- Body:

## 5. 톤 & 매너
### 브랜드 성격
- 키워드:
- 분위기:

### 커뮤니케이션 가이드
- 말투: (예: 격식체/반말/존댓말)
- 피해야 할 표현:
- 선호하는 표현:

## 6. 활용 예시
### 명함
### SNS 프로필
### 포스터/배너
### 웹사이트`,
  },

  "competitor-sheet": {
    title: "경쟁사 분석 시트",
    category: "프로젝트",
    description: "경쟁사를 체계적으로 분석하기 위한 시트입니다.",
    content: `# 경쟁사 분석 시트

## 프로젝트명: [이름]
## 분석일: 2026년 __월 __일

---

## 1. 경쟁사 목록

| No. | 경쟁사명 | 유형 | URL | 설립년도 | 직원 수 |
|-----|---------|------|-----|---------|---------|
| 1 | | 직접/간접 | | | |
| 2 | | 직접/간접 | | | |
| 3 | | 직접/간접 | | | |

## 2. 제품/서비스 비교

| 항목 | 우리 | 경쟁사 A | 경쟁사 B | 경쟁사 C |
|------|------|---------|---------|---------|
| 주요 기능 | | | | |
| 가격 | | | | |
| 타겟 고객 | | | | |
| 차별점 | | | | |
| UX/UI 수준 | ⭐⭐⭐ | | | |
| 기술력 | ⭐⭐⭐ | | | |
| 마케팅 | ⭐⭐⭐ | | | |

## 3. SWOT 분석

### 경쟁사 A: [이름]
| Strengths (강점) | Weaknesses (약점) |
|-----------------|-------------------|
| | |

| Opportunities (기회) | Threats (위협) |
|--------------------|---------------|
| | |

### 경쟁사 B: [이름]
| Strengths (강점) | Weaknesses (약점) |
|-----------------|-------------------|
| | |

| Opportunities (기회) | Threats (위협) |
|--------------------|---------------|
| | |

## 4. 포지셔닝 맵
> 가로축: [예: 가격 (저가 ← → 고가)]
> 세로축: [예: 기능성 (기본 ← → 프리미엄)]

## 5. 차별화 전략
- 우리만의 강점:
- 공략 가능한 틈새:
- 진입 장벽:
- 단기 전략 (3개월):
- 중기 전략 (6개월): `,
  },

  "spec-sheet": {
    title: "기능 명세서 양식",
    category: "프로젝트",
    description: "플랫폼/앱 MVP 프로젝트에서 기능을 정의하기 위한 명세서 양식입니다.",
    content: `# 기능 명세서 (PRD)

## 프로젝트명: [이름]
## 버전: v1.0
## 작성일: 2026년 __월 __일
## 작성자:

---

## 1. 개요
### 프로젝트 목표
>

### 타겟 사용자
- Primary:
- Secondary:

### 성공 지표 (KPI)
| 지표 | 목표값 | 측정 방법 |
|------|--------|----------|
| | | |

## 2. 사용자 스토리

### Epic 1: [기능 그룹명]
| ID | 사용자 스토리 | 우선순위 | 복잡도 |
|----|-------------|----------|--------|
| US-001 | ~로서, ~하기 위해, ~하고 싶다 | P0/P1/P2 | S/M/L |
| US-002 | | | |

### Epic 2: [기능 그룹명]
| ID | 사용자 스토리 | 우선순위 | 복잡도 |
|----|-------------|----------|--------|
| US-010 | | | |

## 3. 기능 상세

### 3.1 [기능명]
- **설명**:
- **입력**:
- **출력**:
- **비즈니스 규칙**:
  1.
  2.
- **예외 처리**:
  -
- **UI 와이어프레임**: (첨부 또는 링크)

### 3.2 [기능명]
- **설명**:
- **입력**:
- **출력**:

## 4. 비기능 요구사항
- 성능: 페이지 로딩 __초 이내
- 보안: HTTPS, 개인정보 암호화
- 호환성: Chrome, Safari, Mobile
- 접근성: WCAG 2.1 AA

## 5. API 설계 (주요 엔드포인트)
| Method | Endpoint | 설명 | Request | Response |
|--------|----------|------|---------|----------|
| GET | /api/v1/ | | | |
| POST | /api/v1/ | | | |

## 6. 데이터 모델
### 주요 테이블
| 테이블 | 주요 컬럼 | 설명 |
|--------|----------|------|
| | | |

## 7. 마일스톤
| 단계 | 기간 | 주요 산출물 |
|------|------|-----------|
| 기획 | ~주 | PRD, 와이어프레임 |
| 개발 | ~주 | MVP 빌드 |
| 테스트 | ~주 | QA 리포트 |
| 런칭 | ~주 | 배포, 모니터링 |`,
  },

  "tech-stack": {
    title: "기술 스택 문서",
    category: "프로젝트",
    description: "프로젝트에서 사용할 기술 스택을 정리하는 문서입니다.",
    content: `# 기술 스택 문서

## 프로젝트명: [이름]
## 최종 수정: 2026년 __월 __일

---

## 1. 프론트엔드
| 항목 | 선택 | 이유 |
|------|------|------|
| 프레임워크 | Next.js 16 | SSR/SSG 지원, React 생태계 |
| 언어 | TypeScript | 타입 안전성 |
| 스타일링 | Tailwind CSS | 유틸리티 퍼스트 |
| 상태 관리 | React Context / Zustand | 경량 상태 관리 |
| UI 컴포넌트 | shadcn/ui | 커스터마이징 용이 |

## 2. 백엔드
| 항목 | 선택 | 이유 |
|------|------|------|
| BaaS | Supabase | PostgreSQL + Auth + Storage |
| API | REST / Supabase Client | 자동 생성 API |
| 인증 | Supabase Auth | OAuth, Magic Link |
| 파일 저장 | Supabase Storage | S3 호환 |

## 3. 인프라 & 배포
| 항목 | 선택 | 이유 |
|------|------|------|
| 호스팅 | Vercel | Next.js 최적화 |
| CDN | Vercel Edge | 글로벌 배포 |
| 도메인 | *.co.kr | 국내 서비스 |
| 모니터링 | Vercel Analytics | 기본 모니터링 |

## 4. 개발 도구
| 항목 | 선택 |
|------|------|
| IDE | VS Code / Cursor |
| 버전 관리 | Git + GitHub |
| CI/CD | GitHub Actions + Vercel |
| 린팅 | ESLint + Prettier |
| 테스팅 | Vitest + Playwright |

## 5. 외부 서비스
| 서비스 | 용도 | 플랜 |
|--------|------|------|
| Google Drive API | 문서 연동 | Free |
| SendGrid / Resend | 이메일 | Free tier |
| Cloudflare | DNS / 보안 | Free |

## 6. 버전 관리 전략
- 브랜치: main / develop / feature/*
- 커밋 컨벤션: Conventional Commits
- PR 리뷰: 최소 1명 승인

## 7. 환경 변수
| 변수명 | 설명 | 예시 |
|--------|------|------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase URL | https://xxx.supabase.co |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase 공개 키 | eyJ... |
| SUPABASE_SERVICE_ROLE_KEY | 서비스 키 (서버만) | eyJ... |`,
  },

  "cost-settlement": {
    title: "비용 정산 시트",
    category: "프로젝트",
    description: "팝업스토어 등 프로젝트의 비용을 정산하기 위한 양식입니다.",
    content: `# 비용 정산 시트

## 프로젝트명: [이름]
## 정산 기간: 2026년 __월 __일 ~ __월 __일
## 작성자:

---

## 1. 예산 총괄

| 항목 | 예산 | 집행액 | 잔액 | 비율 |
|------|------|--------|------|------|
| 공간 임대 | ₩ | ₩ | ₩ | % |
| 인건비 | ₩ | ₩ | ₩ | % |
| 자재/물품 | ₩ | ₩ | ₩ | % |
| 마케팅 | ₩ | ₩ | ₩ | % |
| 기타 | ₩ | ₩ | ₩ | % |
| **합계** | **₩** | **₩** | **₩** | **%** |

## 2. 지출 상세 내역

| No. | 일자 | 항목 | 카테고리 | 금액 | 결제자 | 영수증 |
|-----|------|------|---------|------|--------|--------|
| 1 | / | | | ₩ | | ☐ |
| 2 | / | | | ₩ | | ☐ |
| 3 | / | | | ₩ | | ☐ |

## 3. 수입 내역 (해당 시)

| No. | 일자 | 항목 | 금액 | 비고 |
|-----|------|------|------|------|
| 1 | / | | ₩ | |

## 4. 멤버별 정산

| 멤버 | 선지급액 | 정산 대상액 | 차액 | 비고 |
|------|---------|-----------|------|------|
| | ₩ | ₩ | ₩ | |

## 5. 정산 요약
- 총 예산: ₩
- 총 집행: ₩
- 잔액: ₩
- 수입: ₩
- 순 비용: ₩

## 6. 비고
- `,
  },

  "operations-manual": {
    title: "운영 매뉴얼",
    category: "프로젝트",
    description: "팝업스토어/이벤트 운영을 위한 매뉴얼입니다.",
    content: `# 운영 매뉴얼

## 프로젝트명: [이름]
## 운영 기간: 2026년 __월 __일 ~ __월 __일
## 운영 장소:

---

## 1. 운영 개요
- 운영 시간: __:__ ~ __:__
- 필요 인원: __명
- 교대 시간:

## 2. 스태프 역할

| 역할 | 담당자 | 주요 업무 |
|------|--------|----------|
| 총괄 | | 전체 운영 관리, 비상 대응 |
| 안내 | | 방문객 응대, 동선 안내 |
| 판매/체험 | | 상품 판매, 체험 프로그램 운영 |
| 포토 | | 사진/영상 촬영, SNS 업로드 |
| 정리 | | 정리정돈, 재고 관리 |

## 3. 일일 운영 타임테이블

| 시간 | 업무 | 담당 |
|------|------|------|
| 오픈 2시간 전 | 셋업, 물품 확인 | 전원 |
| 오픈 1시간 전 | 최종 점검, 브리핑 | 총괄 |
| 오픈 | 운영 시작 | 전원 |
| 중간 | 교대, 점심 | 교대조 |
| 마감 1시간 전 | 마감 안내 | 안내 |
| 마감 | 정산, 정리 | 전원 |

## 4. 비상 대응

### 고객 컴플레인
1. 차분하게 경청
2. 사과 및 해결방안 제시
3. 즉시 해결 불가 시 총괄에게 보고

### 안전 사고
1. 현장 안전 확보
2. 응급 처치 (구급상자 위치: __)
3. 필요 시 119 연락
4. 총괄에게 즉시 보고

### 비상 연락처
| 역할 | 이름 | 연락처 |
|------|------|--------|
| 총괄 | | |
| 공간 관리자 | | |
| 비상 | 119 / 112 | |

## 5. 재고/물품 체크리스트

| 물품 | 수량 | 위치 | 확인 |
|------|------|------|------|
| | | | ☐ |
| | | | ☐ |

## 6. 마감 체크리스트
- [ ] 매출 정산 완료
- [ ] 재고 확인 및 기록
- [ ] 공간 정리 및 청소
- [ ] 전기/가스/수도 확인
- [ ] 문단속 확인
- [ ] 일일 보고 작성`,
  },
};

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const template = templates[slug];

  if (!template) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      {/* Header */}
      <header className="bg-[#1A1A1A] text-white">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm no-underline mb-4 transition-colors"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" as const }}
          >
            <ArrowLeft size={12} /> NutUnion 홈으로
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <span
              className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest border border-white/20"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {template.category} Template
            </span>
          </div>
          <h1
            className="text-2xl font-extrabold mb-2"
            style={{ fontFamily: "'Pretendard', sans-serif" }}
          >
            {template.title}
          </h1>
          <p className="text-white/60 text-sm">{template.description}</p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="bg-white border-2 border-[#1A1A1A]/[0.08] p-8 md:p-12">
          <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-[#333]">
            {template.content.split("\n").map((line, i) => {
              // Render markdown-like headings
              if (line.startsWith("# ")) {
                return (
                  <h1 key={i} className="text-2xl font-extrabold mt-8 mb-4 text-[#1A1A1A]" style={{ fontFamily: "'Pretendard', sans-serif" }}>
                    {line.replace("# ", "")}
                  </h1>
                );
              }
              if (line.startsWith("## ")) {
                return (
                  <h2 key={i} className="text-xl font-bold mt-6 mb-3 text-[#1A1A1A] border-b border-[#1A1A1A]/10 pb-2" style={{ fontFamily: "'Pretendard', sans-serif" }}>
                    {line.replace("## ", "")}
                  </h2>
                );
              }
              if (line.startsWith("### ")) {
                return (
                  <h3 key={i} className="text-base font-bold mt-4 mb-2 text-[#1A1A1A]" style={{ fontFamily: "'Pretendard', sans-serif" }}>
                    {line.replace("### ", "")}
                  </h3>
                );
              }
              if (line.startsWith("> ")) {
                return (
                  <blockquote key={i} className="border-l-4 border-[#FF6B8A] pl-4 italic text-[#666] my-3">
                    {line.replace("> ", "")}
                  </blockquote>
                );
              }
              if (line.startsWith("| ")) {
                return (
                  <div key={i} className="text-xs overflow-x-auto" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    <pre className="whitespace-pre">{line}</pre>
                  </div>
                );
              }
              if (line.startsWith("- [ ] ") || line.startsWith("- [x] ")) {
                const checked = line.startsWith("- [x] ");
                return (
                  <div key={i} className="flex items-center gap-2 ml-4 my-0.5">
                    <input type="checkbox" defaultChecked={checked} className="accent-[#FF6B8A]" />
                    <span className="text-sm">{line.replace(/^- \[.\] /, "")}</span>
                  </div>
                );
              }
              if (line.startsWith("- ")) {
                return (
                  <div key={i} className="flex items-start gap-2 ml-4 my-0.5">
                    <span className="text-[#FF6B8A] mt-1.5 text-[8px]">●</span>
                    <span className="text-sm">{line.replace("- ", "")}</span>
                  </div>
                );
              }
              if (line.startsWith("---")) {
                return <hr key={i} className="border-[#1A1A1A]/10 my-6" />;
              }
              if (line.trim() === "") {
                return <div key={i} className="h-2" />;
              }
              return (
                <p key={i} className="text-sm leading-relaxed my-1">
                  {line}
                </p>
              );
            })}
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-6 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-[#999] hover:text-[#1A1A1A] no-underline transition-colors flex items-center gap-1"
          >
            <ArrowLeft size={12} /> 돌아가기
          </Link>
          <p className="text-[10px] text-[#999]" style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em" }}>
            Powered by NutUnion Templates
          </p>
        </div>
      </main>
    </div>
  );
}
