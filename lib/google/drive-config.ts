/**
 * lib/google/drive-config — Google Drive 저장 전략.
 *
 * **문제**: 기본 로직은 호스트의 개인 Drive 에 폴더를 생성 →
 *         호스트 탈퇴/폴더 삭제 시 너트/볼트의 모든 자료 소실 위험.
 *
 * **해결**: nutunion 조직 공유 드라이브(Shared Drive) 를 기본 저장소로 사용.
 *         호스트는 Shared Drive 안에 서브폴더를 만드는 역할만 함.
 *         소유권은 조직에 있으므로 개인 탈퇴의 영향을 받지 않음.
 *
 * 환경변수:
 *   GOOGLE_SHARED_DRIVE_ID
 *     - Google Workspace 의 Shared Drive ID (admin.google.com → 공유 드라이브)
 *     - 설정 시: 모든 그룹/프로젝트 폴더가 이 Shared Drive 아래에 생성됨
 *     - 미설정 시: 호스트 개인 Drive 에 생성 (legacy behavior)
 *
 *   GOOGLE_SHARED_DRIVE_ROOT_FOLDER_ID (선택)
 *     - Shared Drive 내의 특정 루트 폴더 ID (예: "너트유니온 공유자료")
 *     - 설정 시 모든 신규 폴더가 이 폴더 아래에 생성되어 정리됨
 *     - 미설정 시 Shared Drive 루트에 직접 생성
 */

export interface DriveStorageTarget {
  /** files.create 호출 시 parents 에 넣을 값 */
  parentFolderId?: string;
  /** Shared Drive 사용 시 설정되는 driveId */
  driveId?: string;
  /** supportsAllDrives 플래그 */
  supportsAllDrives: boolean;
  /** 현재 사용 중인 저장 전략 (로그/디버그용) */
  strategy: "shared-folder" | "shared-drive" | "host-drive";
}

/** 환경변수 기반 저장 전략 결정.
 *
 * 우선순위:
 *   1. GOOGLE_DRIVE_SHARED_FOLDER_ID — 단일 공유 폴더 모드 (현재 표준).
 *      모든 너트/볼트가 이 폴더 하나에 같이 저장됨.
 *   2. GOOGLE_SHARED_DRIVE_ID — 조직 Shared Drive 모드 (legacy).
 *   3. 호스트 개인 Drive (legacy).
 */
export function getDriveStorageTarget(): DriveStorageTarget {
  const sharedFolderId = process.env.GOOGLE_DRIVE_SHARED_FOLDER_ID?.trim();
  if (sharedFolderId) {
    return {
      parentFolderId: sharedFolderId,
      supportsAllDrives: true,
      strategy: "shared-folder",
    };
  }

  const sharedDriveId =
    process.env.GOOGLE_SHARED_DRIVE_ID?.trim() ||
    process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID?.trim() ||  // legacy/typo 대응
    process.env.NEXT_PUBLIC_GOOGLE_DRIVE_PARENT_ID?.trim();
  const rootFolderId =
    process.env.GOOGLE_SHARED_DRIVE_ROOT_FOLDER_ID?.trim() ||
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim();

  if (sharedDriveId) {
    return {
      driveId: sharedDriveId,
      parentFolderId: rootFolderId || sharedDriveId,
      supportsAllDrives: true,
      strategy: "shared-drive",
    };
  }

  // Legacy: 호스트 개인 Drive 루트에 생성
  return {
    supportsAllDrives: false,
    strategy: "host-drive",
  };
}

/** 단일 공유 폴더 ID 직접 조회 (없으면 null). */
export function getSharedFolderId(): string | null {
  return process.env.GOOGLE_DRIVE_SHARED_FOLDER_ID?.trim() || null;
}

/** Drive 작업 OAuth 주체로 사용할 owner user UUID — 미설정 시 null. */
export function getDriveOwnerUserId(): string | null {
  return process.env.NUTUNION_DRIVE_OWNER_USER_ID?.trim() || null;
}

/** Drive auth 주체 결정 — owner 가 설정되면 owner, 없으면 currentUserId. */
export async function getDriveAuthUserId(currentUserId: string): Promise<string> {
  return getDriveOwnerUserId() || currentUserId;
}

/** files.create requestBody 에 parents 병합 */
export function withParents<T extends Record<string, unknown>>(
  body: T,
  target: DriveStorageTarget,
): T {
  if (target.parentFolderId) {
    return { ...body, parents: [target.parentFolderId] };
  }
  return body;
}

/** files.create / files.list 의 공통 옵션 */
export function driveRequestOptions(target: DriveStorageTarget) {
  return {
    supportsAllDrives: target.supportsAllDrives,
    includeItemsFromAllDrives: target.supportsAllDrives,
  };
}

/** 설정 상태 요약 (admin UI / 로그용) */
export function describeStorageStrategy(): string {
  const t = getDriveStorageTarget();
  if (t.strategy === "shared-folder") {
    return `Google Drive 단일 공유 폴더 (${t.parentFolderId?.slice(0, 8)}...) — owner 토큰으로 일괄 쓰기`;
  }
  if (t.strategy === "shared-drive") {
    return `Google Shared Drive (${t.driveId?.slice(0, 8)}...) — 호스트 탈퇴 영향 없음`;
  }
  return "호스트 개인 Drive — ⚠ 호스트 탈퇴/폴더 삭제 시 데이터 소실 위험";
}
