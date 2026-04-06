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
      className="h-14 bg-nu-ink overflow-hidden flex items-center border-t-[3px] border-nu-ink border-b-[3px] border-b-nu-pink relative"
      aria-hidden="true"
    >
      {/* Halftone subtle background */}
      <div className="absolute inset-0 halftone-pink opacity-[0.03]" />

      <div className="ticker-track flex whitespace-nowrap">
        {doubled.map((text, i) => (
          <span
            key={i}
            className="font-mono-nu text-[12px] font-bold tracking-[0.25em] uppercase text-nu-paper/50 px-12 flex items-center gap-8"
          >
            <span className="w-2 h-2 bg-nu-pink inline-block rotate-45" />
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
