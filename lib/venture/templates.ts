// 분야별 Venture 템플릿 — 초기 HMW / 아이디어 / 체크리스트 프리셋.
// enable 시 category 선택 → 해당 프리셋 자동 시드.

export type TemplateCategory = "saas" | "community" | "local" | "content" | "generic";

export interface VentureTemplate {
  id: TemplateCategory;
  label: string;
  icon: string;
  description: string;
  hmw_samples: string[];
  idea_samples: { title: string; description: string }[];
  prototype_tasks: string[];
}

export const TEMPLATES: Record<TemplateCategory, VentureTemplate> = {
  saas: {
    id: "saas",
    label: "SaaS / 소프트웨어",
    icon: "💻",
    description: "B2B/B2C SaaS 제품 — 유저 문제 해결 소프트웨어",
    hmw_samples: [
      "어떻게 하면 [타겟 유저]가 [반복 작업]을 50% 빠르게 완료하게 할 수 있을까?",
      "어떻게 하면 [도메인 전문가]가 코드 없이 [결과물]을 만들게 할 수 있을까?",
      "어떻게 하면 [팀]이 [정보 사일로]를 없애고 의사결정을 빠르게 할 수 있을까?",
    ],
    idea_samples: [
      { title: "AI 자동 요약 대시보드", description: "매일/매주 발생하는 대화/문서/이벤트를 AI가 핵심 3~5줄로 요약해 제공" },
      { title: "워크플로 템플릿 마켓", description: "업무별 검증된 자동화 레시피를 공유/설치 — Zapier 같은 but 도메인 특화" },
    ],
    prototype_tasks: [
      "핵심 유저 페르소나 3개 정의",
      "MVP 기능 스펙 1페이지 작성",
      "프로토타입 와이어프레임 (Figma)",
      "유저 인터뷰 5명 진행",
      "초기 사용자 10명 대기명단 확보",
      "가격 모델 가설 3종 수립",
    ],
  },
  community: {
    id: "community",
    label: "커뮤니티 / 모임",
    icon: "👥",
    description: "사람 연결과 집단 활동 — 오프라인/온라인 모임",
    hmw_samples: [
      "어떻게 하면 [특정 관심사]를 가진 사람들이 지속적으로 모이게 할 수 있을까?",
      "어떻게 하면 신규 참여자의 80%가 2회 이상 참여하게 만들 수 있을까?",
      "어떻게 하면 [약한 유대]를 [실질적 협업]으로 전환시킬 수 있을까?",
    ],
    idea_samples: [
      { title: "온보딩 1:1 매칭", description: "신규 멤버를 기존 멤버와 자동 매칭해 첫 만남 주선" },
      { title: "월간 리추얼 + 일간 체크인", description: "월 1회 오프라인 리추얼 + 데일리 간단 체크인으로 참여감 유지" },
    ],
    prototype_tasks: [
      "타겟 멤버 페르소나 + 동기 정의",
      "첫 모임 카날 예약 + 공지",
      "온보딩 양식 (가입 → 첫 만남) 설계",
      "초대 메시지 3가지 버전 A/B",
      "월간 리추얼 1회 실행",
      "참여자 10명 피드백 수집",
    ],
  },
  local: {
    id: "local",
    label: "로컬 / 오프라인",
    icon: "📍",
    description: "특정 지역 기반 — 공간/상권/주민 문제 해결",
    hmw_samples: [
      "어떻게 하면 [동네]의 [특정 문제]를 주민 주도로 해결할 수 있을까?",
      "어떻게 하면 1인 가구가 [일상 불편]을 이웃과 나눠 해결할 수 있을까?",
      "어떻게 하면 [지역 상권]과 [주민]이 서로 이익 되는 관계를 만들 수 있을까?",
    ],
    idea_samples: [
      { title: "공유 주방 운영", description: "동네 공실을 공유 주방으로 전환, 요일별 다른 셰프 운영" },
      { title: "이웃 품앗이 플랫폼", description: "반려동물 돌봄/장보기/소품 수리 등 이웃 간 작은 도움을 중개" },
    ],
    prototype_tasks: [
      "타겟 동네 반경 설정 + 인구 데이터 조사",
      "지역 리더 3명 인터뷰",
      "파일럿 공간 1곳 섭외",
      "첫 이벤트 (테스트) 진행",
      "지역 커뮤니티 채널 (당근/인스타) 홍보",
      "15명 이상 참여자 피드백",
    ],
  },
  content: {
    id: "content",
    label: "콘텐츠 / 미디어",
    icon: "📹",
    description: "뉴스레터 / 팟캐스트 / 유튜브 등 크리에이터 활동",
    hmw_samples: [
      "어떻게 하면 [타겟 청중]이 매주 [콘텐츠]를 기다리게 만들 수 있을까?",
      "어떻게 하면 [틈새 주제]를 깊이 다뤄 충성 독자 500명을 모을까?",
      "어떻게 하면 무료 콘텐츠에서 [유료 전환]을 자연스럽게 유도할 수 있을까?",
    ],
    idea_samples: [
      { title: "주간 큐레이션 뉴스레터", description: "[도메인] 이번 주 핵심 10개 + 에디터 코멘트 + 실전 팁" },
      { title: "이슈 해체 팟캐스트", description: "한 번에 한 이슈만 깊게, 30분 분량으로 격주 발행" },
    ],
    prototype_tasks: [
      "에디토리얼 가이드 (톤/분량/구조) 1페이지",
      "발행 플랫폼 선택 (Substack/Beehiiv/YouTube)",
      "초기 구독자 30명 확보 경로 설정",
      "첫 4회 콘텐츠 제작",
      "CTR/완독률 지표 수집 대시보드",
      "유료 전환 가설 테스트",
    ],
  },
  generic: {
    id: "generic",
    label: "일반 / 기본",
    icon: "🚀",
    description: "분야 무관 — 기본 프로토타입 체크리스트만",
    hmw_samples: [],
    idea_samples: [],
    prototype_tasks: [
      "타겟 유저 10명 리스트업",
      "핵심 가치 한 줄 (Value Proposition) 작성",
      "최소 기능 MVP 스케치/와이어프레임",
      "MVP 실사용 테스트 세션 3회 예약",
      "초기 피드백 수집 양식 준비 (점수 + 노트)",
    ],
  },
};

export function listTemplates(): VentureTemplate[] {
  return Object.values(TEMPLATES);
}
