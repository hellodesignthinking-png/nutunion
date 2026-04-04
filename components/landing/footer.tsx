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
    <footer className="bg-nu-ink text-nu-paper/60 py-16 px-8" role="contentinfo">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
        {/* Brand */}
        <div>
          <span className="font-head text-xl font-extrabold text-nu-paper block mb-3">
            nutunion
          </span>
          <p className="text-sm leading-relaxed">{brandText}</p>
        </div>

        {/* Navigation */}
        <nav aria-label="Footer navigation">
          <span className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-nu-paper/30 mb-4 block">
            Navigation
          </span>
          <div className="flex flex-col gap-2.5">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-sm hover:text-nu-paper transition-colors no-underline"
              >
                {l.label}
              </a>
            ))}
          </div>
        </nav>

        {/* Protocol */}
        <div>
          <span className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-nu-paper/30 mb-4 block">
            Protocol
          </span>
          <div className="flex flex-col gap-2.5">
            {protocolLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-sm hover:text-nu-paper transition-colors no-underline"
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div>
          <span className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-nu-paper/30 mb-4 block">
            Contact
          </span>
          <div className="flex flex-col gap-2.5 text-sm">
            <span>{contactEmail}</span>
            <span>{contactInsta}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto border-t border-white/10 mt-12 pt-6 text-center">
        <span className="font-mono-nu text-[10px] tracking-widest text-nu-paper/25">
          {copyright}
        </span>
      </div>
    </footer>
  );
}
