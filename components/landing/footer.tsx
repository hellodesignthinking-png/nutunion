interface FooterProps {
  content?: Record<string, string>;
}

const defaultNav = [
  { label: "About", href: "#about" },
  { label: "Groups", href: "#groups" },
  { label: "Join", href: "#join" },
];

const defaultProtocol = [
  { label: "Brand Guidelines", href: "#" },
  { label: "Templates", href: "#" },
  { label: "Open Source", href: "#" },
];

export function Footer({ content }: FooterProps) {
  const brandText = content?.brand_text || "공간·문화·플랫폼·바이브를 잇는 protocol collective입니다.";
  const copyright = content?.copyright || `© ${new Date().getFullYear()} nutunion. All rights reserved.`;

  let navLinks = defaultNav;
  let protocolLinks = defaultProtocol;
  let contactEmail = "hello@nutunion.kr";
  let contactInsta = "@nutunion";

  if (content?.links) {
    try {
      const parsed = JSON.parse(content.links);
      if (parsed.nav) navLinks = parsed.nav;
      if (parsed.protocol) protocolLinks = parsed.protocol;
      if (parsed.contact?.email) contactEmail = parsed.contact.email;
      if (parsed.contact?.instagram) contactInsta = parsed.contact.instagram;
    } catch {
      // use defaults
    }
  }

  return (
    <footer className="bg-nu-ink text-nu-paper/60 py-16 px-8 border-t-[3px] border-nu-pink relative overflow-hidden" role="contentinfo">
      {/* Halftone background */}
      <div className="absolute inset-0 halftone-paper opacity-[0.01]" aria-hidden="true" />

      {/* Registration marks */}
      <div className="absolute top-4 left-4 font-mono-nu text-[12px] text-nu-paper/10 select-none" aria-hidden="true">⊕</div>
      <div className="absolute top-4 right-4 font-mono-nu text-[12px] text-nu-paper/10 select-none" aria-hidden="true">⊕</div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 relative">
        {/* Brand */}
        <div className="border-r-0 lg:border-r-[3px] lg:border-nu-paper/10 lg:pr-8">
          <span className="font-head text-2xl font-extrabold text-nu-paper block mb-3 uppercase tracking-tight relative inline-block">
            nutunion
            {/* Overprint ghost */}
            <span className="absolute inset-0 text-nu-pink opacity-20 translate-x-[2px] -translate-y-[1px] pointer-events-none select-none mix-blend-screen" aria-hidden="true">
              nutunion
            </span>
          </span>
          <p className="text-sm leading-relaxed">{brandText}</p>
          <div className="mt-4 font-mono-nu text-[10px] text-nu-paper/15 tracking-widest uppercase">
            EST. 2024 — EDITION 001
          </div>
        </div>

        {/* Navigation */}
        <nav aria-label="Footer navigation">
          <span className="font-mono-nu text-[12px] uppercase tracking-[0.25em] text-nu-paper/30 mb-4 block border-b-[2px] border-nu-paper/10 pb-2">
            Navigation
          </span>
          <div className="flex flex-col gap-2.5">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-sm hover:text-nu-pink transition-colors no-underline font-mono-nu text-[12px] uppercase tracking-widest"
              >
                <span className="text-nu-pink/40 mr-2">→</span>{l.label}
              </a>
            ))}
          </div>
        </nav>

        {/* Protocol */}
        <div>
          <span className="font-mono-nu text-[12px] uppercase tracking-[0.25em] text-nu-paper/30 mb-4 block border-b-[2px] border-nu-paper/10 pb-2">
            Protocol
          </span>
          <div className="flex flex-col gap-2.5">
            {protocolLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-sm hover:text-nu-pink transition-colors no-underline font-mono-nu text-[12px] uppercase tracking-widest"
              >
                <span className="text-nu-blue/40 mr-2">→</span>{l.label}
              </a>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div>
          <span className="font-mono-nu text-[12px] uppercase tracking-[0.25em] text-nu-paper/30 mb-4 block border-b-[2px] border-nu-paper/10 pb-2">
            Contact
          </span>
          <div className="flex flex-col gap-2.5 font-mono-nu text-[12px] tracking-wider">
            <span>{contactEmail}</span>
            <span>{contactInsta}</span>
          </div>

          {/* Decorative stamp */}
          <div className="mt-6 w-16 h-16 border-[2px] border-nu-paper/10 rotate-6 flex items-center justify-center">
            <span className="font-mono-nu text-[9px] font-bold text-nu-paper/20 tracking-widest uppercase -rotate-6">NU</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto border-t-[3px] border-nu-paper/10 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="font-mono-nu text-[12px] tracking-widest text-nu-paper/25">
          {copyright}
        </span>
        <div className="flex items-center gap-4">
          <a
            href="/privacy"
            className="font-mono-nu text-[11px] tracking-widest text-nu-paper/40 hover:text-nu-pink transition-colors no-underline uppercase"
          >
            개인정보처리방침
          </a>
          <span className="text-nu-paper/15">·</span>
          <a
            href="/terms"
            className="font-mono-nu text-[11px] tracking-widest text-nu-paper/40 hover:text-nu-pink transition-colors no-underline uppercase"
          >
            이용약관
          </a>
          <span className="text-nu-paper/15 hidden md:block">·</span>
          <span className="font-mono-nu text-[11px] tracking-widest text-nu-paper/15 hidden md:block">
            RISOGRAPH EDITION — DOPPLE PRESS INSPIRED
          </span>
        </div>
      </div>
    </footer>
  );
}
