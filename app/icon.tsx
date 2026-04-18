import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * 브루탈리스트 모노그램 — "N" (너트유니온)
 * 2.5px nu-ink 보더 + nu-pink 배경.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FF3D88",
          color: "#0D0D0D",
          fontSize: 22,
          fontWeight: 900,
          fontFamily: "system-ui",
          border: "2.5px solid #0D0D0D",
          borderRadius: 2,
        }}
      >
        N
      </div>
    ),
    size
  );
}
