import type { SpacePage, SpaceBlock } from "./space-pages-types";

interface FetchedBlock {
  type: string;
  content: string;
  data: Record<string, unknown>;
}

/**
 * 페이지를 마크다운 문자열로 직렬화.
 * 블록 fetch → 타입별 마크다운 변환.
 *
 * - h1/2/3 → # / ## / ###
 * - bullet → "- " / numbered → "1. " (실제 번호는 1. 만 일괄 — 마크다운 렌더러가 알아서 매김)
 * - todo → "- [ ] " / "- [x] "
 * - quote → "> "
 * - code → ```lang\n...\n```
 * - callout → "> 💡 ..."
 * - divider → "---"
 * - table → 마크다운 테이블 (| 헤더 |)
 * - audio → "🎙 [녹음 N초](data:audio/...)" — base64 길어 데이터 URL 그대로 (큰 파일 주의)
 * - image → "![alt](url)"
 * - embed → "[YouTube](url)" 등 단순 링크
 * - mention 인라인: "@[label](kind:id)" → "**@label**" 로 단순화 (외부 마크다운에서 클릭 안되니)
 */
export async function exportPageAsMarkdown(page: SpacePage): Promise<string> {
  const res = await fetch(`/api/spaces/pages/${page.id}/blocks`);
  if (!res.ok) throw new Error("블록 가져오기 실패");
  const j = await res.json();
  const blocks: FetchedBlock[] = j.blocks ?? [];
  const head = `# ${page.icon || "📄"} ${page.title}\n\n`;
  const meta = `*${new Date(page.updated_at).toLocaleString("ko")} · 마지막 수정*\n\n---\n\n`;
  const body = blocks.map(blockToMarkdown).filter(Boolean).join("\n\n");
  return head + meta + body + "\n";
}

function blockToMarkdown(b: FetchedBlock): string {
  const content = stripMentions(b.content || "");
  switch (b.type) {
    case "h1": return `# ${content}`;
    case "h2": return `## ${content}`;
    case "h3": return `### ${content}`;
    case "text": return content;
    case "bullet": return `- ${content}`;
    case "numbered": return `1. ${content}`;
    case "todo": {
      const checked = (b.data as { checked?: boolean } | undefined)?.checked === true;
      return `- [${checked ? "x" : " "}] ${content}`;
    }
    case "quote": return `> ${content.split("\n").join("\n> ")}`;
    case "code": {
      const lang = String((b.data as { lang?: string } | undefined)?.lang || "");
      return "```" + lang + "\n" + content + "\n```";
    }
    case "divider": return "---";
    case "callout": {
      const icon = (b.data as { icon?: string } | undefined)?.icon || "💡";
      return `> ${icon} ${content.split("\n").join("\n> ")}`;
    }
    case "table": {
      const td = b.data as { columns?: Array<{ name: string }>; rows?: string[][] } | undefined;
      const cols = td?.columns ?? [];
      const rows = td?.rows ?? [];
      if (cols.length === 0) return "";
      const head = "| " + cols.map((c) => c.name || "").join(" | ") + " |";
      const sep = "| " + cols.map(() => "---").join(" | ") + " |";
      const body = rows.map((r) => "| " + r.map((c) => (c || "").replace(/\|/g, "\\|")).join(" | ") + " |").join("\n");
      return [head, sep, body].filter(Boolean).join("\n");
    }
    case "image": {
      const d = b.data as { url?: string; alt?: string } | undefined;
      if (!d?.url) return "";
      return `![${d.alt || ""}](${d.url})`;
    }
    case "audio": {
      const d = b.data as { url?: string; duration_sec?: number } | undefined;
      if (!d?.url) return "";
      const cap = d.duration_sec ? `🎙 음성 메모 ${d.duration_sec}초` : "🎙 음성 메모";
      // data URL 은 마크다운 본문에 그대로 넣으면 매우 길어짐 — 표시는 캡션만
      return `[${cap}](${d.url.startsWith("data:") ? "#audio-inline" : d.url})`;
    }
    case "embed": {
      const d = b.data as { url?: string; kind?: string } | undefined;
      if (!d?.url) return "";
      const label = d.kind ? `🔗 ${d.kind}` : "🔗 링크";
      return `[${label}](${d.url})`;
    }
    default: return content;
  }
}

/** mention chip 마크다운 `@[label](kind:id)` → 단순 `**@label**` 로 (외부에서 링크 안 되므로) */
function stripMentions(text: string): string {
  return text.replace(/@\[([^\]]+)\]\(([a-z]+):([^)]+)\)/g, (_m, label) => `**@${label}**`);
}
