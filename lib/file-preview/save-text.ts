/**
 * 텍스트 파일을 R2 에 덮어쓰기 — file-preview-panel 의 handleSaveText 로직.
 *
 * UI 상태 분리: state 는 panel 이 보유, 본 함수는 순수 IO 만 담당.
 * 1) /api/storage/r2/presign 으로 overwrite_key 받기
 * 2) PUT 으로 R2 덮어쓰기
 * 3) DB row updated_at(+ file_size) 갱신 (best-effort)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { guessMime } from "./detect-kind";

export interface SaveTextArgs {
  file: { id: string; name: string; mime?: string | null; storage_key?: string | null };
  targetTable: "file_attachments" | "project_resources";
  textContent: string;
  supabase: SupabaseClient;
}

export interface SaveTextResult {
  bytes: number;
  warning?: string;
}

export async function saveTextToR2(args: SaveTextArgs): Promise<SaveTextResult> {
  const { file, targetTable, textContent, supabase } = args;
  if (!file.storage_key) throw new Error("R2 storage_key 가 없습니다");

  const mime = guessMime(file.name, file.mime);
  const bytes = new TextEncoder().encode(textContent);

  // 1) presign with overwrite_key
  const presignRes = await fetch("/api/storage/r2/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prefix: "resources",
      fileName: file.name,
      contentType: mime,
      size: bytes.byteLength,
      overwrite_key: file.storage_key,
    }),
  });
  const presign = await presignRes.json();
  if (!presignRes.ok || !presign.configured || !presign.url) {
    throw new Error(presign.error || "presign 실패");
  }

  // 2) PUT
  const putRes = await fetch(presign.url, {
    method: "PUT",
    headers: { "Content-Type": mime },
    body: bytes,
  });
  if (!putRes.ok) throw new Error(`PUT 실패 ${putRes.status}`);

  // 3) Update DB row updated_at + file_size (best-effort — R2 저장은 이미 완료)
  let warning: string | undefined;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (targetTable === "file_attachments") {
    updates.file_size = bytes.byteLength;
  }
  const { error } = await supabase.from(targetTable).update(updates).eq("id", file.id);
  if (error) warning = `R2 저장은 됐지만 DB 갱신 실패: ${error.message}`;

  return { bytes: bytes.byteLength, warning };
}
