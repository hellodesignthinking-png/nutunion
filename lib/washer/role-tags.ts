/**
 * Washer Role Tags — 프로필의 역할 팔레트.
 *
 * 3 그룹:
 *  - project (프로젝트형): pm/designer/developer/writer/researcher
 *  - operation (운영형): operator/manager/staff/accountant/chef
 *  - platform (플랫폼형): po/engineer/support/marketer/data
 *  - meta (메타): mentor/investor/sponsor/ambassador
 */

export type RoleTag =
  // 프로젝트형
  | "pm"
  | "designer"
  | "developer"
  | "writer"
  | "researcher"
  // 운영형
  | "operator"
  | "manager"
  | "staff"
  | "accountant"
  | "chef"
  // 플랫폼형
  | "po"
  | "engineer"
  | "support"
  | "marketer"
  | "data"
  // 메타
  | "mentor"
  | "investor"
  | "sponsor"
  | "ambassador";

export interface RoleGroup {
  key: string;
  label: string;
  emoji: string;
  tags: Array<{ key: RoleTag; label: string; hint?: string }>;
}

export const ROLE_GROUPS: RoleGroup[] = [
  {
    key: "project",
    label: "프로젝트형",
    emoji: "🎯",
    tags: [
      { key: "pm", label: "PM", hint: "프로젝트 매니저" },
      { key: "designer", label: "디자이너" },
      { key: "developer", label: "개발자" },
      { key: "writer", label: "작가·기자" },
      { key: "researcher", label: "리서처" },
    ],
  },
  {
    key: "operation",
    label: "운영형",
    emoji: "🏢",
    tags: [
      { key: "operator", label: "운영자" },
      { key: "manager", label: "매니저" },
      { key: "staff", label: "스태프" },
      { key: "accountant", label: "회계" },
      { key: "chef", label: "셰프·바리스타" },
    ],
  },
  {
    key: "platform",
    label: "플랫폼형",
    emoji: "🌐",
    tags: [
      { key: "po", label: "PO" },
      { key: "engineer", label: "엔지니어" },
      { key: "support", label: "CS" },
      { key: "marketer", label: "마케터" },
      { key: "data", label: "데이터" },
    ],
  },
  {
    key: "meta",
    label: "메타",
    emoji: "🔗",
    tags: [
      { key: "mentor", label: "멘토" },
      { key: "investor", label: "투자자" },
      { key: "sponsor", label: "스폰서" },
      { key: "ambassador", label: "앰배서더" },
    ],
  },
];

export const ALL_ROLE_TAGS: RoleTag[] = ROLE_GROUPS.flatMap((g) => g.tags.map((t) => t.key));

export function labelForTag(tag: RoleTag): string {
  for (const g of ROLE_GROUPS) {
    for (const t of g.tags) if (t.key === tag) return t.label;
  }
  return tag;
}

export const MAX_ROLE_TAGS = 7;
