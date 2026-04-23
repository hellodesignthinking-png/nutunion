/**
 * Client-side 통합 업로더 — R2 우선, Supabase Storage fallback.
 *
 * 사용:
 *   const { url, storage } = await uploadFile(file, { prefix: "chat" });
 *
 * 반환:
 *   url      : 공개 접근 가능한 URL (R2 public 또는 Supabase public)
 *   storage  : 'r2' | 'supabase' (DB 에 storage_type 으로 저장)
 *   key      : 스토리지 내부 경로
 *   size     : 파일 크기
 *
 * 동작:
 *   1) /api/storage/r2/presign 호출 → R2 설정됐으면 presigned URL 획득
 *   2) 브라우저에서 R2 로 직접 PUT 업로드
 *   3) 실패 또는 R2 미설정 시 Supabase Storage('media' 버킷) 로 fallback
 *
 * 4.5MB Vercel 제한 영향 없음 — 서버는 서명만 발급하고 실제 바이너리는 스트리밍으로 직접 감.
 */

import { createClient } from "@/lib/supabase/client";

export interface UploadResult {
  url: string;
  storage: "r2" | "supabase";
  key: string;
  size: number;
  mime: string;
  name: string;
}

export interface UploadOptions {
  /** 경로 prefix — chat / avatars / resources / taps / uploads */
  prefix?: "chat" | "avatars" | "resources" | "taps" | "uploads";
  /** Supabase fallback 시 사용할 추가 경로 세그먼트 (예: roomId) */
  scopeId?: string;
  /** 업로드 진행률 콜백 (R2 직접 업로드 시만 동작) */
  onProgress?: (pct: number) => void;
}

export async function uploadFile(file: File, opts: UploadOptions = {}): Promise<UploadResult> {
  const prefix = opts.prefix || "uploads";
  const mime = file.type || "application/octet-stream";

  // 1) R2 시도
  try {
    const presignRes = await fetch("/api/storage/r2/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prefix,
        fileName: file.name,
        contentType: mime,
        size: file.size,
      }),
    });
    const presign = await presignRes.json();

    if (presignRes.ok && presign.configured && presign.url) {
      // PUT 업로드 (진행률 원하면 XHR 사용, 기본은 fetch)
      if (opts.onProgress) {
        await uploadWithProgress(presign.url, file, mime, opts.onProgress);
      } else {
        const putRes = await fetch(presign.url, {
          method: "PUT",
          headers: { "Content-Type": mime },
          body: file,
        });
        if (!putRes.ok) throw new Error(`R2 PUT 실패 ${putRes.status}`);
      }
      return {
        url: presign.publicUrl,
        storage: "r2",
        key: presign.key,
        size: file.size,
        mime,
        name: file.name,
      };
    }
    // presign.configured === false → fallback
    if (typeof window !== "undefined" && presign && presign.configured === false) {
      try {
        window.dispatchEvent(
          new CustomEvent("nu:storage-fallback", {
            detail: {
              reason: "R2 not configured",
              missing_env: presign.missing_env || [],
              file: { name: file.name, size: file.size, mime },
            },
          }),
        );
      } catch { /* noop */ }
    }
  } catch (err) {
    console.warn("[uploadFile] R2 실패 — Supabase fallback", err);
    // 관측용 CustomEvent — 필요 시 토스트 리스너가 붙을 수 있도록 노출만 해 둠
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(
          new CustomEvent("nu:storage-fallback", {
            detail: {
              reason: err instanceof Error ? err.message : String(err),
              file: { name: file.name, size: file.size, mime },
            },
          }),
        );
      } catch { /* noop */ }
    }
  }

  // 2) Supabase fallback
  //    media 버킷이 이미지/비디오만 허용하도록 설정된 환경이 있어,
  //    오디오/문서/기타 파일은 MIME 을 video/* 로 위장해서 올리는 기존 패턴 유지.
  const supabase = createClient();

  const storageMime = disguiseMimeForSupabase(mime);
  // Blob 자체의 type 도 변조돼야 Supabase 가 MIME 검사를 통과함
  const disguisedFile =
    storageMime === mime
      ? file
      : new File([file], file.name, { type: storageMime });

  const safeName = file.name.replace(/[^\w.\-]/g, "_").slice(0, 80);
  const scope = opts.scopeId ? `${opts.scopeId}/` : "";
  const key = `${prefix}/${scope}${Date.now()}_${safeName}`;

  const { error: upErr } = await supabase.storage
    .from("media")
    .upload(key, disguisedFile, { contentType: storageMime, upsert: false });
  if (upErr) throw new Error("Supabase 업로드 실패: " + upErr.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from("media").getPublicUrl(key);

  return {
    url: publicUrl,
    storage: "supabase",
    key,
    size: file.size,
    mime,
    name: file.name,
  };
}

/**
 * Supabase media 버킷이 이미지/비디오만 허용해서,
 * 오디오/문서/기타 파일을 video/* 로 위장해 업로드 통과시키는 매핑.
 *
 * R2 를 쓰면 이 로직은 경로에 영향 없음 — 필요한 MIME 그대로 Content-Type 으로 저장됨.
 */
function disguiseMimeForSupabase(mime: string): string {
  const m = (mime || "").toLowerCase();

  // 이미지/비디오는 대부분 원본 허용
  if (m.startsWith("image/")) return mime;
  if (m.startsWith("video/")) return mime;

  // 오디오 → video/* 위장
  if (m.startsWith("audio/")) {
    if (m.includes("webm")) return "video/webm";
    if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "video/mp4";
    if (m.includes("mpeg") || m.includes("mp3")) return "video/mp4";
    return "video/webm";
  }

  // 문서/기타 — Supabase media 버킷이 image/video 만 허용하는 환경에서도 통과하도록
  // 전부 video/mp4 로 위장 (실제 바이너리는 그대로, MIME 만 변조)
  // PDF, DOC, XLS, PPT, ZIP, TXT, JSON 등 모두 적용
  return "video/mp4";
}

/** 진행률 지원 — XHR */
function uploadWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`R2 PUT ${xhr.status}`));
    xhr.onerror = () => reject(new Error("network error"));
    xhr.send(file);
  });
}
