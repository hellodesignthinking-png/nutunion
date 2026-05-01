"use client";

interface Block {
  id: string;
  type: string;
  content: string;
  data: Record<string, unknown>;
  position: number;
}

/**
 * 공유 페이지의 read-only 블록 렌더 — 편집 핸들러 없는 슬림 버전.
 * SpaceBlockRenderer 와 별개 — interactive textarea/멘션/AI 등 다 제외.
 */
export function SharedPageRenderer({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-2">
      {blocks.map((b) => <RenderBlock key={b.id} block={b} />)}
      {blocks.length === 0 && (
        <p className="text-nu-muted italic">빈 페이지</p>
      )}
    </div>
  );
}

function RenderBlock({ block }: { block: Block }) {
  const c = stripMentions(block.content || "");
  const data = block.data || {};
  const color = (data as { color?: string }).color || "default";
  const align = (data as { align?: string }).align || "left";
  const alignCls = align === "center" ? "text-center" : align === "right" ? "text-right" : "";
  const colorCls = color !== "default" ? `text-${colorMap(color)}-700` : "text-nu-ink";

  switch (block.type) {
    case "h1": return <h1 className={`text-[24px] font-extrabold mt-4 ${colorCls} ${alignCls}`}>{c}</h1>;
    case "h2": return <h2 className={`text-[20px] font-extrabold mt-3 ${colorCls} ${alignCls}`}>{c}</h2>;
    case "h3": return <h3 className={`text-[16px] font-extrabold mt-2 ${colorCls} ${alignCls}`}>{c}</h3>;
    case "text":
      return <p className={`text-[14px] leading-relaxed ${colorCls} ${alignCls}`}>{c}</p>;
    case "bullet":
      return <li className="ml-5 list-disc text-[14px] text-nu-ink">{c}</li>;
    case "numbered":
      return <li className="ml-5 list-decimal text-[14px] text-nu-ink">{c}</li>;
    case "todo": {
      const checked = (data as { checked?: boolean }).checked === true;
      return (
        <div className="flex items-start gap-2">
          <input type="checkbox" checked={checked} disabled className="mt-1.5 w-4 h-4" />
          <span className={`text-[14px] ${checked ? "line-through text-nu-muted" : "text-nu-ink"}`}>{c}</span>
        </div>
      );
    }
    case "quote":
      return <blockquote className="border-l-[4px] border-nu-pink pl-3 py-1 italic text-[14px] text-nu-ink/85">{c}</blockquote>;
    case "code": {
      const lang = (data as { lang?: string }).lang;
      return (
        <pre className="bg-nu-ink text-nu-paper px-3 py-2 font-mono-nu text-[12px] overflow-auto">
          {lang && <div className="text-[9px] uppercase tracking-widest opacity-60 mb-1">{lang}</div>}
          <code>{c}</code>
        </pre>
      );
    }
    case "divider":
      return <hr className="border-nu-ink/20 my-3" />;
    case "callout": {
      const icon = (data as { icon?: string }).icon || "💡";
      return (
        <div className="bg-yellow-50 border-[2px] border-yellow-700 px-3 py-2 flex gap-2">
          <span className="text-[18px]">{icon}</span>
          <p className="text-[13px] text-yellow-950">{c}</p>
        </div>
      );
    }
    case "table": {
      const td = data as { columns?: Array<{ name: string }>; rows?: string[][] };
      const cols = td.columns ?? [];
      const rows = td.rows ?? [];
      if (cols.length === 0) return null;
      return (
        <div className="overflow-x-auto border-[2px] border-nu-ink">
          <table className="w-full text-[12px]">
            <thead className="bg-nu-cream/40 border-b-[2px] border-nu-ink">
              <tr>{cols.map((col, i) => (
                <th key={i} className="px-2 py-1 text-left font-mono-nu text-[11px] font-bold uppercase tracking-widest border-r border-nu-ink/15 last:border-r-0">{col.name}</th>
              ))}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b border-nu-ink/10 last:border-b-0">
                  {r.map((cell, ci) => (
                    <td key={ci} className="px-2 py-1 border-r border-nu-ink/10 last:border-r-0">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "image": {
      const d = data as { url?: string; alt?: string };
      if (!d.url) return null;
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={d.url} alt={d.alt || ""} className="max-w-full border-[2px] border-nu-ink" />;
    }
    case "embed": {
      const d = data as { url?: string; kind?: string };
      if (!d.url) return null;
      // 공유 페이지에서는 보안상 embed 도 외부 링크로만
      return (
        <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-nu-pink underline text-[13px]">
          🔗 {d.kind || "링크"}: {d.url}
        </a>
      );
    }
    case "audio": {
      const d = data as { url?: string };
      if (!d.url) return null;
      return <audio controls src={d.url} className="w-full" />;
    }
    default:
      return <p className="text-[14px] text-nu-ink">{c}</p>;
  }
}

function stripMentions(text: string): string {
  return text.replace(/@\[([^\]]+)\]\([a-z]+:[^)]+\)/g, (_m, label) => `@${label}`);
}

function colorMap(c: string): string {
  if (c === "amber" || c === "emerald" || c === "sky" || c === "violet" || c === "red") return c;
  if (c === "pink") return "pink";
  return "stone";
}
