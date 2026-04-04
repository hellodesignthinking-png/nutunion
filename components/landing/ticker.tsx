interface TickerProps {
  content?: Record<string, string>;
}

const defaultItems = [
  "protocol collective",
  "scene-maker",
  "space → culture → fandom",
  "nutunion",
  "platform builder",
  "vibe curator",
  "open protocol",
  "culture architect",
];

export function Ticker({ content }: TickerProps) {
  let items = defaultItems;
  if (content?.items) {
    try {
      items = JSON.parse(content.items);
    } catch {
      // use defaults
    }
  }
  const doubled = [...items, ...items];

  return (
    <div
      className="h-11 bg-nu-ink overflow-hidden flex items-center border-t border-nu-paper/[0.08] border-b border-b-nu-paper/[0.08]"
      aria-hidden="true"
    >
      <div className="ticker-track flex whitespace-nowrap">
        {doubled.map((text, i) => (
          <span
            key={i}
            className="font-mono-nu text-[11px] font-bold tracking-[0.2em] uppercase text-nu-paper/40 px-12 flex items-center gap-8"
          >
            <span className="w-1 h-1 rounded-full bg-nu-pink inline-block" />
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
