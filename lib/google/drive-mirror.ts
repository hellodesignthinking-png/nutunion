/**
 * lib/google/drive-mirror — 자료실/채팅 첨부 파일을 Google Drive 에 자동 미러링.
 *
 * 호출 조건:
 *  - 대상 그룹/프로젝트에 google_drive_folder_id 가 설정되어 있고
 *  - 업로더의 Google 계정이 연결되어 있음
 *
 * 실패 시:
 *  - 조용히 log 만. 원본 업로드 (Supabase/R2) 는 이미 완료된 상태이므로 사용자 경험에 영향 없음
 */

import { google } from "googleapis";
import { Readable } from "stream";
import { getGoogleClient } from "@/lib/google/auth";
import {
  driveRequestOptions,
  getDriveStorageTarget,
  getSharedFolderId,
  getDriveOwnerUserId,
} from "./drive-config";

export interface MirrorInput {
  userId: string;
  folderId: string;
  fileUrl?: string;        // 이미 업로드된 공개 URL (fetch 해서 다운로드)
  fileBuffer?: Buffer;     // 또는 직접 buffer
  fileName: string;
  mimeType: string;
}

export interface MirrorResult {
  driveFileId?: string;
  webViewLink?: string;
  skipped?: boolean;
  reason?: string;
}

export async function mirrorToDrive(input: MirrorInput): Promise<MirrorResult> {
  const { userId, folderId, fileUrl, fileBuffer, fileName, mimeType } = input;

  // 단일 공유 폴더 모드: env 폴더가 우선. 없으면 호출자 folderId.
  const envSharedFolderId = getSharedFolderId();
  const targetFolderId = envSharedFolderId || folderId;
  if (!targetFolderId) return { skipped: true, reason: "no_folder" };

  const driveOwnerId = getDriveOwnerUserId();
  const authUserId = driveOwnerId || userId;

  let auth;
  try {
    auth = await getGoogleClient(authUserId);
  } catch {
    return { skipped: true, reason: "user_not_connected" };
  }

  let buffer: Buffer;
  if (fileBuffer) {
    buffer = fileBuffer;
  } else if (fileUrl) {
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) return { skipped: true, reason: "fetch_failed" };
      const ab = await res.arrayBuffer();
      buffer = Buffer.from(ab);
    } catch {
      return { skipped: true, reason: "fetch_error" };
    }
  } else {
    return { skipped: true, reason: "no_source" };
  }

  try {
    const drive = google.drive({ version: "v3", auth });
    const target = getDriveStorageTarget();

    const res = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [targetFolderId],
      },
      media: {
        mimeType,
        body: Readable.from(buffer),
      },
      fields: "id, name, webViewLink, webContentLink",
      ...driveRequestOptions(target),
      supportsAllDrives: true,
    });

    return {
      driveFileId: res.data.id || undefined,
      webViewLink: res.data.webViewLink || undefined,
    };
  } catch (err) {
    console.warn("[drive-mirror] upload failed", err);
    return { skipped: true, reason: "upload_failed" };
  }
}

/** 너트 자료실의 서브폴더 선택 (회의록/탭/자료) */
export async function getGroupResourcesFolder(
  supabase: any,
  groupId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("groups")
    .select("google_drive_folder_id, google_drive_resources_folder_id")
    .eq("id", groupId)
    .maybeSingle();
  if (!data) return null;
  // "자료" 서브폴더가 있으면 우선, 없으면 루트
  return (
    (data as any).google_drive_resources_folder_id ||
    (data as any).google_drive_folder_id ||
    null
  );
}

/** 볼트 자료실의 서브폴더 선택 (기획/중간산출/증빙/최종) */
export async function getProjectStageFolder(
  supabase: any,
  projectId: string,
  stage?: "planning" | "interim" | "evidence" | "final",
): Promise<string | null> {
  const { data } = await supabase
    .from("projects")
    .select(
      "google_drive_folder_id, google_drive_planning_folder_id, google_drive_interim_folder_id, google_drive_evidence_folder_id, google_drive_final_folder_id",
    )
    .eq("id", projectId)
    .maybeSingle();
  if (!data) return null;
  const p = data as any;
  if (stage === "planning") return p.google_drive_planning_folder_id || p.google_drive_folder_id || null;
  if (stage === "interim") return p.google_drive_interim_folder_id || p.google_drive_folder_id || null;
  if (stage === "evidence") return p.google_drive_evidence_folder_id || p.google_drive_folder_id || null;
  if (stage === "final") return p.google_drive_final_folder_id || p.google_drive_folder_id || null;
  // 기본: 증빙 폴더 (가장 일반적인 자료 카테고리)
  return p.google_drive_evidence_folder_id || p.google_drive_folder_id || null;
}
