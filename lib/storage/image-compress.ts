"use client";

/**
 * 영수증·자료 사진을 업로드 직전에 축소 + EXIF 회전 적용.
 *
 * 왜:
 *  - 모바일 카메라는 5-12MB JPEG 을 기본으로 찍는다 — 영수증 인식·미리보기엔 과도.
 *  - 세로로 찍은 사진은 EXIF Orientation 으로만 회전이 표현돼 일부 뷰어에서 가로로 보임.
 *  - createImageBitmap(file, { imageOrientation: 'from-image' }) 가 EXIF 회전을 미리 적용해
 *    canvas 가 그대로 그리면 회전된 정상 이미지가 된다.
 *
 * 비이미지(PDF 등)는 원본 그대로 통과.
 */

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

export async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  // SVG/GIF 는 손실 변환이 부적절 — 통과
  if (/svg|gif/i.test(file.type)) return file;

  if (typeof createImageBitmap !== "function") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  } catch {
    // 일부 환경에서 옵션 미지원 → 옵션 없이 한 번 더
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      return file;
    }
  }

  const { width: w0, height: h0 } = bitmap;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(w0, h0));
  const w = Math.round(w0 * scale);
  const h = Math.round(h0 * scale);

  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement("canvas"), { width: w, height: h });

  const ctx = (canvas as HTMLCanvasElement | OffscreenCanvas).getContext("2d");
  if (!ctx) return file;
  (ctx as CanvasRenderingContext2D).drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob =
    canvas instanceof OffscreenCanvas
      ? await canvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY })
      : await new Promise<Blob | null>((res) =>
          (canvas as HTMLCanvasElement).toBlob(res, "image/jpeg", JPEG_QUALITY),
        );

  if (!blob) return file;
  // 압축 결과가 더 크면(이미 작은 파일) 원본 유지
  if (blob.size >= file.size * 0.95) return file;

  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
}
