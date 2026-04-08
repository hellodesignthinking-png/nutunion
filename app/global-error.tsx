"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("GLOBAL ERROR:", error.message, error.digest, error.stack);
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#FAF8F5", margin: 0, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "2rem" }}>
        <div style={{ maxWidth: "480px", width: "100%", background: "#fff", border: "2px solid rgba(13,13,13,0.08)", padding: "3rem 2rem", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0D0D0D", margin: "0 0 0.75rem" }}>페이지 로드 오류</h2>
          <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem", lineHeight: 1.6 }}>
            페이지를 불러오는 중 서버 오류가 발생했습니다.
          </p>
          {error.digest && (
            <p style={{ fontFamily: "monospace", fontSize: "0.6rem", color: "#999", background: "#f5f5f5", padding: "0.5rem 1rem", marginBottom: "1rem", wordBreak: "break-all" }}>
              Error ID: {error.digest}
            </p>
          )}
          <p style={{ fontFamily: "monospace", fontSize: "0.65rem", color: "#c00", background: "#fff0f0", padding: "0.5rem 1rem", marginBottom: "1.5rem", wordBreak: "break-all", maxHeight: "8rem", overflow: "auto", textAlign: "left" }}>
            {error.message}
          </p>
          <button
            onClick={reset}
            style={{ fontFamily: "monospace", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", padding: "0.75rem 2rem", background: "#0D0D0D", color: "#FAF8F5", border: "none", cursor: "pointer" }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
