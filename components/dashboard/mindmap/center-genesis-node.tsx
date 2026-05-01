"use client";

import { useState } from "react";
import { Handle, Position } from "reactflow";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CenterNodeData {
  kind: "center";
  title: string;
  subtitle?: string;
  /** 응답 후 호출 — 부모에서 관련 노드 하이라이트 + 임시 노드 추가 + plan 풀 패널 노출 */
  onAnswer: (result: {
    text: string;
    keywords: string[];
    roles: Array<{ name: string; tags?: string[]; why?: string }>;
    tasks: string[];
    /** Genesis 가 만든 전체 plan — phases/wiki/milestones/folders 포함. 부모가 panel 로 펼침. */
    plan?: Record<string, unknown>;
    intent?: string;
  }) => void;
  /** 컨텍스트 제안 칩 — 사용자 데이터 기반으로 부모가 만들어 보냄. 입력 비어있을 때 표시. */
  suggestions?: string[];
}

/**
 * Phase C — 마인드맵 중앙에 들어가는 인터랙티브 Genesis 입력 노드.
 *
 * 동작:
 *  1) 사용자가 "오늘 가장 먼저 할 일은?" 같은 질문 입력
 *  2) /api/genesis/plan 호출 (기존 인프라, lease 멱등성 + Gateway 자동 fallback)
 *  3) 응답에서 phases/first_tasks 키워드 추출
 *  4) onAnswer 콜백으로 키워드 전달 — 부모가 매칭되는 가지 노드 하이라이트
 *
 * 응답은 짧게 노드 안에 표시. 자세한 답변이 길면 줄임.
 */
export function CenterGenesisNode({ data }: { data: CenterNodeData }) {
  const [intent, setIntent] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string>("");
  const [error, setError] = useState<string>("");

  async function ask() {
    const trimmed = intent.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError("");
    setAnswer("");

    // 45초 timeout — Genesis 는 평균 10~25초지만 가끔 hang. AbortController 로 안전.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45_000);

    // 디버깅: 사용자 측 정확한 진단을 위해 콘솔에 자세히 — preload 경고와 섞이지 않게 prefix.
    console.info("[Genesis] 요청 시작:", trimmed);
    // 멱등성 키는 헤더에 들어가야 하므로 ASCII 만 — 한글은 SHA-256 해시로 변환.
    // (이전에 raw 한글을 헤더에 넣어 ISO-8859-1 위반으로 fetch 자체가 실패했음)
    const idempotencyKey = await sha256Hex(`mindmap:${trimmed}`).then((h) => h.slice(0, 16));
    try {
      const res = await fetch("/api/genesis/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ intent: trimmed, kind: "group" }),
        signal: controller.signal,
      });
      const text = await res.text();
      console.info(`[Genesis] HTTP ${res.status} body length=${text.length}`);
      let json: Record<string, unknown> | null = null;
      try { json = text ? JSON.parse(text) : null; } catch {
        console.error("[Genesis] JSON 파싱 실패. 응답 본문:", text.slice(0, 500));
      }

      if (!res.ok) {
        const apiErr = (json?.error as string | undefined)
          || (json?.code as string | undefined)
          || `HTTP ${res.status}`;
        const detail = (json?.detail as string | undefined) || "";
        console.error(`[Genesis] 서버 거부 ${res.status}:`, apiErr, detail || json);
        // 사용자가 줌 아웃되어 노드 안 에러가 안 보일 때를 대비해 toast 도 함께
        toast.error(`Genesis 실패 (${res.status}): ${apiErr}${detail ? ` — ${detail}` : ""}`, { duration: 8000 });
        throw new Error(`${res.status} ${apiErr}`);
      }
      console.info("[Genesis] 응답 성공", { keys: json ? Object.keys(json) : [] });

      const plan = (json?.plan ?? {}) as Record<string, unknown>;
      const summary: string = (plan.summary as string) || (plan.title as string) || "응답 생성됨";
      setAnswer(summary.slice(0, 140));

      // 키워드 추출 — phases.name + first_tasks 의 명사·동사 (하이라이트용)
      const keywords = new Set<string>();
      ((plan.phases as Array<Record<string, unknown>> | undefined) ?? []).forEach((p) => {
        if (p?.name) keywords.add(String(p.name).toLowerCase());
      });
      const tasks: string[] = ((plan.first_tasks as unknown[] | undefined) ?? [])
        .slice(0, 4)
        .map((t) => String(t));
      tasks.forEach((t) => {
        t.toLowerCase().split(/\s+/).slice(0, 3).forEach((w: string) => {
          if (w.length > 2) keywords.add(w);
        });
      });
      const roles = (((plan.suggested_roles as Array<Record<string, unknown>> | undefined) ?? [])
        .slice(0, 4)
        .map((r) => ({
          name: String(r?.role_name || r?.name || "역할"),
          tags: Array.isArray(r?.specialty_tags) ? (r.specialty_tags as unknown[]).map(String) : [],
          why: r?.why ? String(r.why) : undefined,
        })));
      data.onAnswer({
        text: summary,
        keywords: Array.from(keywords),
        roles,
        tasks,
        plan,
        intent: trimmed,
      });
      toast.success(`💡 매칭 ${keywords.size}개 · 역할 ${roles.length}개 · 액션 ${tasks.length}개 — 우측 패널에서 자세히`);
    } catch (err) {
      const msg = err instanceof Error
        ? (err.name === "AbortError" ? "AI 응답 45초 초과 — 다시 시도해주세요" : err.message)
        : "알 수 없는 오류";
      console.error("[Genesis] 예외:", err);
      setError(msg);
      // 노드 안 에러 박스 + toast 둘 다 — 어느 줌 레벨에서도 보이게
      if (!msg.startsWith("Genesis 실패")) {
        toast.error(msg, { duration: 8000 });
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  return (
    <div
      className="relative bg-white border-[3px] border-nu-ink px-4 py-3 min-w-[260px] max-w-[320px]"
      style={{
        // 다층 그림자 — 브루탈리스트 offset + 핑크 발광
        boxShadow:
          "3px 3px 0 0 #0D0F14, 0 0 0 4px rgba(255,61,136,0.12), 0 0 32px 8px rgba(255,61,136,0.35), 0 0 64px 16px rgba(255,184,46,0.18)",
      }}
    >
      {/* 회전하는 글로우 링 — 항상 살아있음 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-1 -z-10 opacity-60 animate-pulse"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(255,61,136,0.4), rgba(255,184,46,0.4), rgba(46,91,255,0.4), rgba(255,61,136,0.4))",
          filter: "blur(12px)",
        }}
      />
      <Handle type="source" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Left} style={{ opacity: 0 }} />

      <div className="flex items-center gap-1.5 mb-1">
        <Sparkles size={14} className="text-nu-pink" />
        <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">Genesis AI</span>
      </div>
      <div className="font-head text-[14px] font-extrabold text-nu-ink mb-2 truncate">{data.title}</div>

      <form
        onSubmit={(e) => { e.preventDefault(); void ask(); }}
        className="flex items-center gap-1 border-[2px] border-nu-ink/20 focus-within:border-nu-ink"
      >
        <input
          type="text"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="궁금한 점을 물어보세요"
          disabled={loading}
          maxLength={500}
          className="flex-1 px-2 py-1.5 text-[12px] outline-none bg-transparent disabled:opacity-50"
          aria-label="Genesis AI 에 질문하기 (최대 500자)"
        />
        <button
          type="submit"
          disabled={loading || !intent.trim()}
          className="px-2 py-1.5 bg-nu-pink text-nu-paper disabled:opacity-40"
          aria-label="질문 보내기"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
        </button>
      </form>
      {/* 컨텍스트 제안 칩 — 사용자가 무엇을 물어볼지 모를 때 */}
      {!intent && !loading && !answer && data.suggestions && data.suggestions.length > 0 && (
        <div className="relative z-10 mt-2 flex flex-wrap gap-1">
          {data.suggestions.slice(0, 4).map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIntent(s)}
              className="font-mono-nu text-[10px] tracking-wide bg-nu-cream/70 hover:bg-nu-cream border border-nu-ink/20 hover:border-nu-ink px-1.5 py-0.5 text-nu-ink/80 hover:text-nu-ink"
              title="입력창에 채우기"
            >
              💬 {s}
            </button>
          ))}
        </div>
      )}
      {intent.length > 400 && (
        <div className={`mt-1 font-mono-nu text-[10px] text-right ${intent.length >= 500 ? "text-red-700" : "text-nu-muted"}`}>
          {intent.length} / 500
        </div>
      )}

      {answer && !loading && (
        <div className="relative z-10 mt-2 text-[11px] text-nu-ink/80 bg-white border-[2px] border-nu-ink/30 px-2 py-1.5 shadow-[1px_1px_0_0_#0D0F14]">
          💡 {answer}
        </div>
      )}
      {error && (
        <div className="relative z-10 mt-2 text-[11px] text-red-800 bg-red-50 border-[2px] border-red-700 px-2 py-1.5 shadow-[1px_1px_0_0_#0D0F14]">
          ⚠ {error}
        </div>
      )}
    </div>
  );
}

/** 브라우저 SubtleCrypto 로 SHA-256 hex 생성 — 헤더에 한글 못 넣는 제약 우회. */
async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
