import Link from "next/link";

interface JoinSectionProps {
  content?: Record<string, string>;
}

export function JoinSection({ content }: JoinSectionProps) {
  const title = content?.title || "Union에 합류하세요";
  const subtitle =
    content?.subtitle || "당신의 전문성이 새로운 Scene의 시작입니다";

  return (
    <section id="join" className="grid grid-cols-1 lg:grid-cols-2 min-h-[60vh] border-t-[3px] border-nu-ink">
      {/* Left visual — Risograph poster */}
      <div className="relative bg-nu-ink flex items-center justify-center overflow-hidden min-h-[40vh] lg:min-h-0">
        {/* Risograph poster background */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/join-risograph.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-35 mix-blend-screen" aria-hidden="true" />
        <div className="absolute inset-0 halftone-pink opacity-[0.04]" aria-hidden="true" />

        {/* Overprint color blocks */}
        <div className="absolute top-0 left-0 w-1/2 h-2/3 bg-nu-pink/[0.08] mix-blend-screen" aria-hidden="true" />
        <div className="absolute bottom-0 right-0 w-2/3 h-1/2 bg-nu-blue/[0.06] mix-blend-screen" aria-hidden="true" />

        {/* Registration marks */}
        <div className="absolute top-4 left-4 font-mono-nu text-[10px] text-nu-paper/15 select-none" aria-hidden="true">⊕</div>
        <div className="absolute top-4 right-4 font-mono-nu text-[10px] text-nu-paper/15 select-none" aria-hidden="true">⊕</div>
        <div className="absolute bottom-4 left-4 font-mono-nu text-[10px] text-nu-paper/15 select-none" aria-hidden="true">⊕</div>
        <div className="absolute bottom-4 right-4 font-mono-nu text-[10px] text-nu-paper/15 select-none" aria-hidden="true">⊕</div>

        {/* Large JOIN text — misregistered */}
        <div className="relative">
          <span
            className="font-head text-[clamp(100px,14vw,220px)] font-extrabold select-none opacity-[0.08] -rotate-6"
            style={{ WebkitTextStroke: "3px rgba(244,241,234,0.5)", color: "transparent" }}
            aria-hidden="true"
          >
            JOIN
          </span>
          {/* Pink offset */}
          <span
            className="absolute inset-0 font-head text-[clamp(100px,14vw,220px)] font-extrabold select-none opacity-[0.05] -rotate-6 translate-x-[4px] -translate-y-[3px]"
            style={{ WebkitTextStroke: "3px rgba(255,72,176,0.8)", color: "transparent" }}
            aria-hidden="true"
          >
            JOIN
          </span>
          {/* Blue offset */}
          <span
            className="absolute inset-0 font-head text-[clamp(100px,14vw,220px)] font-extrabold select-none opacity-[0.04] -rotate-6 -translate-x-[3px] translate-y-[2px]"
            style={{ WebkitTextStroke: "3px rgba(0,85,255,0.7)", color: "transparent" }}
            aria-hidden="true"
          >
            JOIN
          </span>
        </div>

        <div className="absolute inset-0 flex flex-col justify-end p-12">
          <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-paper/25">
            become a member
          </span>
        </div>

        {/* Decorative stamp */}
        <div className="absolute top-12 right-12 w-20 h-20 border-[3px] border-nu-pink/30 rotate-12 flex items-center justify-center">
          <span className="font-mono-nu text-[7px] font-bold text-nu-pink/30 tracking-widest uppercase -rotate-12">OPEN</span>
        </div>
      </div>

      {/* Right content */}
      <div className="flex flex-col justify-center p-10 lg:p-16 bg-nu-paper relative overflow-hidden">
        {/* Halftone decoration */}
        <div className="absolute top-0 right-0 w-40 h-40 halftone-blue opacity-[0.04]" aria-hidden="true" />

        <h2 className="font-head text-[clamp(32px,4vw,48px)] font-extrabold tracking-tighter text-nu-ink leading-[0.9]">
          {title.split("").map((char, i) => char === " " ? " " : char)}
        </h2>
        <p className="text-nu-gray mt-4 max-w-md leading-relaxed border-l-[3px] border-nu-ink/20 pl-4">
          {subtitle}. 공간, 문화, 플랫폼, 바이브 — 어떤 분야든 함께 만들어갑니다.
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-8">
          <Link
            href="/signup"
            className="font-mono-nu text-[11px] font-bold tracking-[0.1em] uppercase px-7 py-4 bg-nu-ink text-nu-paper border-[3px] border-nu-ink hover:bg-nu-pink hover:border-nu-pink transition-all hover:translate-x-1 hover:-translate-y-1 hover:shadow-[-4px_4px_0_#0D0D0D] no-underline"
          >
            회원가입
          </Link>
          <Link
            href="/login"
            className="font-mono-nu text-[11px] font-bold tracking-[0.1em] uppercase px-7 py-4 bg-transparent text-nu-ink border-[3px] border-nu-ink hover:bg-nu-yellow hover:border-nu-yellow transition-all hover:translate-x-1 hover:-translate-y-1 hover:shadow-[-4px_4px_0_#0D0D0D] no-underline"
          >
            로그인
          </Link>
        </div>
      </div>
    </section>
  );
}
