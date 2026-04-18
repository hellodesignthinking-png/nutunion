import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";
export const metadata = { title: "디자인 시스템" };

export default async function DesignSystemPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") redirect("/admin");

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-10">
      <header>
        <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-1">
          Internal · Design System
        </div>
        <h1 className="text-[22px] sm:text-[26px] font-bold text-nu-ink">디자인 시스템</h1>
        <p className="text-[13px] text-nu-graphite mt-1">
          nutunion 브루탈리스트 SaaS 컴포넌트 레퍼런스. shadcn 베이스 + nu-* 토큰.
        </p>
      </header>

      {/* 색상 */}
      <Section title="Color Tokens" slug="colors">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Swatch name="nu-ink" hex="#0D0D0D" cls="bg-nu-ink" />
          <Swatch name="nu-paper" hex="#FAF8F5" cls="bg-nu-paper border-[2px] border-nu-ink" />
          <Swatch name="nu-pink" hex="#FF3D88" cls="bg-nu-pink" />
          <Swatch name="nu-graphite" hex="#666" cls="bg-nu-graphite" />
          <Swatch name="nu-amber" hex="#FFB82E" cls="bg-nu-amber" />
        </div>
      </Section>

      {/* 타이포 */}
      <Section title="Typography" slug="typography">
        <div className="space-y-3 border-[2.5px] border-nu-ink bg-nu-paper p-5">
          <div className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-graphite">
            Mono Label · 11px · tracking 0.3em
          </div>
          <h1 className="text-[26px] font-bold text-nu-ink">Heading 26px Bold</h1>
          <h2 className="text-[20px] font-bold text-nu-ink">Heading 20px Bold</h2>
          <p className="text-[14px] text-nu-ink">Body 14px — 협업 중 장시간 읽기에 최적화된 사이즈.</p>
          <p className="text-[12px] text-nu-graphite">Caption 12px — 부속 정보/메타데이터.</p>
        </div>
      </Section>

      {/* 버튼 */}
      <Section title="Buttons — Brutalist" slug="buttons">
        <div className="flex flex-wrap gap-2 items-center">
          <Button variant="brutalist" size="brutal-sm">sm</Button>
          <Button variant="brutalist" size="brutal-md">md</Button>
          <Button variant="brutalist" size="brutal-lg">LARGE</Button>
        </div>
        <div className="flex flex-wrap gap-2 items-center mt-3">
          <Button variant="brutalist" size="brutal-md">기본</Button>
          <Button variant="brutalist-primary" size="brutal-md">주 액션</Button>
          <Button variant="brutalist-ink" size="brutal-md">강조</Button>
          <Button variant="brutalist-ghost" size="brutal-md">고스트</Button>
          <Button variant="brutalist-danger" size="brutal-md">삭제</Button>
        </div>
        <Snippet code={`<Button variant="brutalist-primary" size="brutal-md">저장</Button>`} />
      </Section>

      {/* 배지 */}
      <Section title="Badges" slug="badges">
        <div className="flex flex-wrap gap-2 items-center">
          <Badge variant="brutalist">Default</Badge>
          <Badge variant="brutalist-pink">Accent</Badge>
          <Badge variant="brutalist-ink">Ink</Badge>
          <Badge variant="brutalist-muted">Muted</Badge>
        </div>
        <Snippet code={`<Badge variant="brutalist-pink">NEW</Badge>`} />
      </Section>

      {/* 입력 */}
      <Section title="Inputs" slug="inputs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
          <Input variant="brutalist" placeholder="이름" />
          <Input variant="brutalist" type="email" placeholder="email@domain" />
          <Input variant="brutalist" type="number" placeholder="금액" />
          <Input variant="brutalist" type="date" />
        </div>
        <Snippet code={`<Input variant="brutalist" placeholder="..." />`} />
      </Section>

      {/* 카드 */}
      <Section title="Cards" slug="cards">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card variant="brutalist">
            <div className="px-4 py-3">
              <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite">brutalist</div>
              <div className="text-[14px] text-nu-ink mt-1">기본 대시보드 카드</div>
            </div>
          </Card>
          <Card variant="brutalist-shadow">
            <div className="px-4 py-3">
              <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite">brutalist-shadow</div>
              <div className="text-[14px] text-nu-ink mt-1">히어로/랜딩용 offset 그림자</div>
            </div>
          </Card>
          <Card>
            <div className="px-4 py-3">
              <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite">default (shadcn)</div>
              <div className="text-[14px] text-nu-ink mt-1">기존 신선 SaaS 카드</div>
            </div>
          </Card>
        </div>
        <Snippet code={`<Card variant="brutalist-shadow">...</Card>`} />
      </Section>

      {/* 공간 + 테두리 */}
      <Section title="Spacing & Borders" slug="spacing">
        <div className="flex gap-2 items-end">
          <Sample label="2.5px" border="border-[2.5px]" />
          <Sample label="2px" border="border-[2px]" />
          <Sample label="4px" border="border-[4px]" />
          <Sample label="1.5px" border="border-[1.5px]" />
        </div>
        <p className="text-[12px] text-nu-graphite mt-2">
          기본: <code className="font-mono-nu">2.5px border-nu-ink</code>. 강조 헤더/배너는 4px, 부속 요소는 1.5~2px.
        </p>
      </Section>

      <div className="text-[11px] text-nu-graphite pt-6 border-t border-nu-ink/10">
        이 페이지는 admin 전용. 새 UI 요소 제작 시 이 시스템을 기준으로 조립하세요. 재사용 &gt; 중복 디자인.
      </div>
    </div>
  );
}

function Section({ title, slug, children }: { title: string; slug: string; children: React.ReactNode }) {
  return (
    <section id={slug} className="scroll-mt-20">
      <h2 className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-graphite mb-3 border-b-[2px] border-nu-ink pb-2">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Swatch({ name, hex, cls }: { name: string; hex: string; cls: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className={`h-20 ${cls}`} aria-hidden />
      <div className="font-mono-nu text-[10px] uppercase tracking-wider text-nu-ink">{name}</div>
      <div className="font-mono-nu text-[9px] text-nu-graphite">{hex}</div>
    </div>
  );
}

function Sample({ label, border }: { label: string; border: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-14 h-14 bg-nu-paper ${border} border-nu-ink`} />
      <span className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite">{label}</span>
    </div>
  );
}

function Snippet({ code }: { code: string }) {
  return (
    <pre className="mt-2 bg-nu-ink/5 border-l-[3px] border-nu-ink/30 px-3 py-2 font-mono text-[11px] text-nu-ink overflow-x-auto">
      {code}
    </pre>
  );
}
