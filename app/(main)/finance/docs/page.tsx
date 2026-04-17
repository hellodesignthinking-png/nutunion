import Link from "next/link";

export const dynamic = "force-static";
export const metadata = { title: "사내 규정" };

const DOCS = [
  { id: "rules", title: "취업규칙", description: "근로조건 및 복무규율", icon: "📋", chapters: 7 },
  { id: "charter", title: "정관", description: "법인 설립 및 운영 기본 규정", icon: "📜", chapters: 6 },
  { id: "privacy", title: "개인정보처리방침", description: "개인정보 수집·이용·보호", icon: "🔒", chapters: 9 },
];

export default function FinanceDocsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-3">
        <Link href="/finance" className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline">
          ← 재무 홈
        </Link>
      </div>

      <div className="mb-8">
        <div className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-graphite mb-2">
          DOCS · 사내 규정
        </div>
        <h1 className="text-[24px] sm:text-[32px] font-bold text-nu-ink leading-tight">
          회사 규정 열람
        </h1>
        <p className="text-[13px] text-nu-graphite mt-2">
          취업규칙, 정관, 개인정보처리방침을 열람·인쇄할 수 있습니다.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {DOCS.map((doc) => (
          <Link
            key={doc.id}
            href={`/finance/docs/${doc.id}`}
            className="block border-[2.5px] border-nu-ink bg-nu-paper p-6 no-underline hover:shadow-[4px_4px_0_0_#0D0D0D] hover:-translate-x-[2px] hover:-translate-y-[2px] transition-all"
          >
            <div className="text-[32px] mb-3">{doc.icon}</div>
            <h3 className="text-[18px] font-bold text-nu-ink mb-1">{doc.title}</h3>
            <p className="text-[12px] text-nu-graphite mb-3">{doc.description}</p>
            <div className="flex justify-between items-center pt-3 border-t border-nu-ink/10">
              <span className="font-mono-nu text-[10px] uppercase tracking-wider text-nu-graphite">
                {doc.chapters}개 장
              </span>
              <span className="font-mono-nu text-[10px] uppercase tracking-wider text-nu-pink">
                읽기 →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
