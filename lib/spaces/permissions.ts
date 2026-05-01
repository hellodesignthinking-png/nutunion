import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 스페이스 권한 모델 — 너트/볼트 의 기존 멤버 역할을 capability 로 매핑.
 *
 *   nut:
 *     host       → admin (모든 권한 + 공유/삭제 + 페이지 권한 관리)
 *     moderator  → editor (생성/편집)
 *     member     → editor
 *
 *   bolt:
 *     lead       → admin
 *     member     → editor
 *     observer   → viewer (읽기만)
 *
 * RLS 는 read/write 만 거르고, 세부 capability (delete others' / share / manage permissions) 는
 * application 측에서 가드. UI 도 같이 가드해 회색 처리.
 */
export type SpaceRole = "admin" | "editor" | "viewer";

export interface SpacePermissions {
  role: SpaceRole;
  can_create: boolean;
  can_edit: boolean;
  can_delete_own: boolean;
  can_delete_others: boolean;
  can_share: boolean;
  can_manage_permissions: boolean;
}

export const ROLE_LABEL: Record<SpaceRole, string> = {
  admin:  "관리자",
  editor: "편집자",
  viewer: "뷰어",
};

const PERMISSIONS: Record<SpaceRole, Omit<SpacePermissions, "role">> = {
  admin: {
    can_create: true,
    can_edit: true,
    can_delete_own: true,
    can_delete_others: true,
    can_share: true,
    can_manage_permissions: true,
  },
  editor: {
    can_create: true,
    can_edit: true,
    can_delete_own: true,
    can_delete_others: false,
    can_share: false,
    can_manage_permissions: false,
  },
  viewer: {
    can_create: false,
    can_edit: false,
    can_delete_own: false,
    can_delete_others: false,
    can_share: false,
    can_manage_permissions: false,
  },
};

export function getPermissions(role: SpaceRole): SpacePermissions {
  return { role, ...PERMISSIONS[role] };
}

/**
 * 서버에서 사용자 역할 조회 — 너트/볼트 별 멤버십 + role 컬럼 매핑.
 */
export async function getSpaceRole(
  supabase: SupabaseClient,
  userId: string,
  ownerType: "nut" | "bolt",
  ownerId: string,
): Promise<SpaceRole | null> {
  if (ownerType === "nut") {
    const { data } = await supabase
      .from("group_members")
      .select("role")
      .eq("group_id", ownerId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!data) return null;
    if (data.role === "host") return "admin";
    return "editor"; // moderator/member 모두 editor
  }
  if (ownerType === "bolt") {
    const { data } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", ownerId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return null;
    if (data.role === "lead") return "admin";
    if (data.role === "observer") return "viewer";
    return "editor";
  }
  return null;
}
