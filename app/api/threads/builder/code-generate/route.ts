import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateTextForUser } from "@/lib/ai/vault";

// POST /api/threads/builder/code-generate
// Body: { prompt: string, base_spec?: any }
// Returns: { source: string, reasoning: string, model_used?: string }
//
// Generates a single-file React/TypeScript ThreadComponent function from natural language.
// Validates output against an allowlist + denylist before returning.

const SYSTEM_PROMPT = `당신은 React/TypeScript 컴포넌트 코드 생성기입니다.

사용자 요구사항을 받아 단일 React 함수형 컴포넌트(TSX)를 생성합니다.

규칙:
1. 컴포넌트 이름: \`ThreadComponent\`
2. props: { installation: { id, target_type, target_id, config }, currentUserId, canEdit }
3. 외부 라이브러리: react, react-dom 만 사용 (Tailwind CSS 클래스 OK)
4. fetch 는 가능 (서버 API 호출 OK)
5. import 금지 — 모든 코드를 단일 파일에 inline
6. 30줄 ~ 200줄 범위
7. 보안: localStorage / window.parent / postMessage 외 외부 API 접근 금지

응답 형식:
첫 줄에 \`// REASONING: <설계 의도 1-2문장 한국어>\`
이후 코드만. 마크다운 펜스(\`\`\`) 없이.
\`function ThreadComponent(props) { ... }\` 로 시작.`;

const STRICTER_SUFFIX = `\n\n[STRICT 재시도] 이전 응답에 금지된 패턴이 포함되었습니다. import / eval / Function() / require() / process.env / <script> 모두 금지. 다시 생성하세요.`;

const FORBIDDEN_PATTERNS: { needle: string; label: string }[] = [
  { needle: "eval(", label: "eval()" },
  { needle: "Function(", label: "Function() constructor" },
  { needle: "__proto__", label: "__proto__" },
  { needle: "process.env", label: "process.env" },
  { needle: "require(", label: "require()" },
  { needle: "import(", label: "dynamic import()" },
  { needle: "<script", label: "<script> tag" },
  { needle: "<iframe", label: "<iframe> tag" },
];

function stripFences(s: string): string {
  let out = s.trim();
  if (out.startsWith("```")) {
    out = out.replace(/^```[a-zA-Z]*\n?/, "").replace(/```\s*$/, "");
  }
  return out.trim();
}

function extractReasoning(s: string): { source: string; reasoning: string } {
  const lines = s.split("\n");
  let reasoning = "";
  let startIdx = 0;
  if (lines[0]?.startsWith("// REASONING:")) {
    reasoning = lines[0].replace(/^\/\/\s*REASONING:\s*/, "").trim();
    startIdx = 1;
  }
  return { source: lines.slice(startIdx).join("\n").trim(), reasoning };
}

function validate(source: string): { ok: true } | { ok: false; reason: string } {
  if (!/function\s+ThreadComponent\b/.test(source) && !/const\s+ThreadComponent\s*=/.test(source)) {
    return { ok: false, reason: "ThreadComponent 함수가 정의되지 않았습니다." };
  }
  if (/^\s*import\s/m.test(source)) {
    return { ok: false, reason: "import 문이 포함되어 있습니다." };
  }
  for (const { needle, label } of FORBIDDEN_PATTERNS) {
    if (source.includes(needle)) return { ok: false, reason: `금지 패턴 발견: ${label}` };
  }
  const lines = source.split("\n").length;
  if (lines < 10) return { ok: false, reason: `코드가 너무 짧습니다 (${lines} 줄)` };
  if (lines > 400) return { ok: false, reason: `코드가 너무 깁니다 (${lines} 줄)` };
  return { ok: true };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const prompt: string | undefined = body?.prompt;
  const base_spec = body?.base_spec;
  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
    return NextResponse.json({ error: "prompt_too_short" }, { status: 400 });
  }

  const userPrompt =
    `사용자 요구사항:\n${prompt}\n\n` +
    (base_spec ? `참고 base spec:\n${JSON.stringify(base_spec, null, 2)}\n\n` : "") +
    `위 요구사항을 충족하는 ThreadComponent 를 생성하세요. 첫 줄은 // REASONING: ...`;

  let lastError = "";
  let modelUsed = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await generateTextForUser(user.id, {
        system: SYSTEM_PROMPT + (attempt > 0 ? STRICTER_SUFFIX : ""),
        prompt: userPrompt,
        tier: "pro",
        maxOutputTokens: 4000,
      });
      modelUsed = (result as any).model_used || modelUsed;
      const cleaned = stripFences((result as any).text || "");
      const { source, reasoning } = extractReasoning(cleaned);
      const v = validate(source);
      if (v.ok) {
        // Audit log (best-effort)
        try {
          await supabase.from("threads_code_audit").insert({
            user_id: user.id,
            prompt,
            source,
            reasoning,
          });
        } catch {
          /* table may not exist yet — non-fatal */
        }
        return NextResponse.json({ source, reasoning, model_used: modelUsed });
      }
      lastError = v.reason;
    } catch (e: any) {
      lastError = e?.message || "ai_failed";
    }
  }
  return NextResponse.json({ error: `code_generation_failed: ${lastError}` }, { status: 500 });
}
