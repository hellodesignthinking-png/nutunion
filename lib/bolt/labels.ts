/**
 * Bolt 유형별 UI 라벨 / 설명 / 아이콘 / 색상.
 *
 * 유일한 진실의 원천(single source of truth) — 생성 플로우, 배지, 상세 페이지,
 * 관리자 통계에서 모두 이 테이블을 import.
 */

import type { BoltType } from "./types";

export interface BoltTypeMeta {
  type: BoltType;
  emoji: string;
  icon: string;           // lucide-react 아이콘 이름 (컴포넌트 쪽에서 동적 매핑)
  label: string;          // 한국어 라벨
  labelEn: string;        // 영문 라벨 (브랜드용)
  tagline: string;        // 한 줄 설명 (유형 선택 카드)
  detail: string;         // 상세 설명 (유형 선택 카드 본문)
  timeMode: "bounded" | "continuous" | "container" | "campaign";
  examples: string[];     // Taina 실제 사례
  color: string;          // Tailwind 클래스 (bg-*)
  accentColor: string;    // text-*
  borderColor: string;    // border-*
}

export const BOLT_TYPE_META: Record<BoltType, BoltTypeMeta> = {
  hex: {
    type: "hex",
    emoji: "🎯",
    icon: "Target",
    label: "탐사형 볼트",
    labelEn: "Hex Bolt",
    tagline: "시작과 끝이 있는 프로젝트",
    detail: "마일스톤·산출물·마감일이 명확한 프로젝트. 완료 시 Tap 아카이브로 승격.",
    timeMode: "bounded",
    examples: ["사회적기업 신청", "LH 검토보고서", "MVP 개발"],
    color: "bg-nu-pink/10",
    accentColor: "text-nu-pink",
    borderColor: "border-nu-pink",
  },
  anchor: {
    type: "anchor",
    emoji: "🏢",
    icon: "Building2",
    label: "공간형 볼트",
    labelEn: "Anchor Bolt",
    tagline: "매장·공간 운영",
    detail: "종료일 없는 공간 운영. 일일 매출·원가·인건비 입력, 주간 P&L, 월간 결산.",
    timeMode: "continuous",
    examples: ["Flagtale 본점", "FlagtaleSWR 카페", "Arts Stay"],
    color: "bg-nu-amber/10",
    accentColor: "text-nu-amber",
    borderColor: "border-nu-amber",
  },
  carriage: {
    type: "carriage",
    emoji: "🌐",
    icon: "Globe",
    label: "플랫폼형 볼트",
    labelEn: "Carriage Bolt",
    tagline: "디지털 서비스",
    detail: "런칭 후 지속 운영되는 서비스. DAU·Uptime·릴리스 트래킹, Sprint 중첩 가능.",
    timeMode: "continuous",
    examples: ["ZeroSite", "nutunion", "SecondWind Run"],
    color: "bg-nu-blue/10",
    accentColor: "text-nu-blue",
    borderColor: "border-nu-blue",
  },
  eye: {
    type: "eye",
    emoji: "🔗",
    icon: "Layers",
    label: "포트폴리오형 볼트",
    labelEn: "Eye Bolt",
    tagline: "여러 볼트를 묶기",
    detail: "하위 볼트(Anchor·Carriage·Hex)를 묶어 통합 KPI와 P&L 롤업을 제공.",
    timeMode: "container",
    examples: ["Flagtale 홀딩", "너트유니온 홀딩스"],
    color: "bg-purple-500/10",
    accentColor: "text-purple-600",
    borderColor: "border-purple-500",
  },
  wing: {
    type: "wing",
    emoji: "📢",
    icon: "Megaphone",
    label: "캠페인형 볼트",
    labelEn: "Wing Bolt",
    tagline: "단기 캠페인 (1~4주)",
    detail: "짧은 기간의 푸시. 목표 지표·채널별 예산·일일 진도 추적. 종료 시 자동 회고.",
    timeMode: "campaign",
    examples: ["북런칭 이벤트", "신제품 출시", "모집 캠페인"],
    color: "bg-green-500/10",
    accentColor: "text-green-700",
    borderColor: "border-green-500",
  },
  torque: {
    type: "torque",
    emoji: "🎓",
    icon: "GraduationCap",
    label: "컨설팅형 볼트",
    labelEn: "Torque Bolt",
    tagline: "외부 전문가 × 내부 팀 협업",
    detail: "컨설턴트와 팀이 이중 미팅 트랙으로 협력. 요청 큐 + 공유 대시보드 + 이중 AI Copilot.",
    timeMode: "bounded",
    examples: ["브랜드 컨설팅", "경영 진단", "시장진입 자문"],
    color: "bg-teal-500/10",
    accentColor: "text-teal-700",
    borderColor: "border-teal-500",
  },
};

export function boltTypeLabel(type: BoltType): string {
  return BOLT_TYPE_META[type].label;
}

export function boltTypeEmoji(type: BoltType): string {
  return BOLT_TYPE_META[type].emoji;
}

export function boltTypeBadgeClasses(type: BoltType): string {
  const meta = BOLT_TYPE_META[type];
  return `${meta.color} ${meta.accentColor} ${meta.borderColor}`;
}
