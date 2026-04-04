import Link from "next/link";

interface JoinSectionProps {
  content?: Record<string, string>;
}

export function JoinSection({ content }: JoinSectionProps) {
  const title = content?.title || "Union에 합류하세요";
  const subtitle =
    content?.subtitle || "당신의 전문성이 새로운 Scene의 시작입니다";

  return (
    <section id="join" className="grid grid-cols-1 lg:grid-cols-2 min-h-[60vh]">
      {/* Left visual */}
      <div className="relative bg-nu-ink flex items-center justify-center overflow-hidden min-h-[40vh] lg:min-h-0">
        {/* Decorative gradient orbs */}
        <div className="absolute top-1/3 right-1/4 w-48 h-48 bg-nu-pink/15 rounded-full blur-[80px]" aria-hidden="true" />
        <div className="absolute bottom-1/3 left-1/3 w-36 h-36 bg-nu-yellow/10 rounded-full blur-[60px]" aria-hidden="true" />

        <span
          className="font-head text-[clamp(100px,12vw,200px)] font-extrabold select-none opacity-[0.06] -rotate-6"
          style={{ WebkitTextStroke: "2px rgba(244,241,234,0.5)", color: "transparent" }}
          aria-hidden="true"
        >
          JOIN
        </span>
        <div className="absolute inset-0 flex flex-col justify-end p-12">
          <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-paper/25">
            become a member
          </span>
        </div>
      </div>

      {/* Right content */}
      <div className="flex flex-col justify-center p-10 lg:p-16">
        <h2 className="font-head text-4xl font-extrabold tracking-tight text-nu-ink">
          {title}
        </h2>
        <p className="text-nu-gray mt-4 max-w-md leading-relaxed">
          {subtitle}. 공간, 문화, 플랫폼, 바이브 — 어떤 분야든 함께 만들어갑니다.
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-8">
          <Link
            href="/signup"
            className="font-mono-nu text-[11px] font-bold tracking-[0.1em] uppercase px-7 py-4 bg-nu-ink text-nu-paper border-[1.5px] border-nu-ink hover:bg-nu-pink hover:border-nu-pink transition-all no-underline"
          >
            회원가입
          </Link>
          <Link
            href="/login"
            className="font-mono-nu text-[11px] font-bold tracking-[0.1em] uppercase px-7 py-4 bg-transparent text-nu-ink border-[1.5px] border-nu-ink hover:bg-nu-yellow hover:border-nu-yellow transition-all no-underline"
          >
            로그인
          </Link>
        </div>
      </div>
    </section>
  );
}
