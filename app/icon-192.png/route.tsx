import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
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
          fontSize: 130,
          fontWeight: 900,
          fontFamily: "system-ui",
          border: "12px solid #0D0D0D",
        }}
      >
        N
      </div>
    ),
    { width: 192, height: 192 }
  );
}
