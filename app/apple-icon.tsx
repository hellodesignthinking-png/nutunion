import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 120,
          fontWeight: 900,
          fontFamily: "system-ui",
          border: "12px solid #0D0D0D",
        }}
      >
        N
      </div>
    ),
    size
  );
}
