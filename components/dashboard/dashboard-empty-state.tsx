import Link from "next/link";
import { Users, Rocket, BookOpen, Target, ArrowRight, Sparkles } from "lucide-react";

interface Props {
  nickname: string;
  groupCount: number;
  projectCount: number;
}

/**
 * 신규 가입자 / 미참여 유저 대시보드 상단 온보딩 카드.
 * 가입한 너트/볼트가 없으면 탐색 CTA 제공, 있으면 null.
 */
export function DashboardEmptyState({ nickname, groupCount, projectCount }: Props) {
  if (groupCount > 0 || projectCount > 0) return null;

  const steps = [
    {
      icon: Users,
      title: "너트 (Nut) 참여",
      description: "관심사나 프로젝트 주제가 비슷한 사람들이 모인 너트를 찾아 가입",
      href: "/groups",
      cta: "너트 탐색",
      color: "text-nu-pink",
      bg: "bg-nu-pink/5",
      border: "border-nu-pink/30",
    },
    {
      icon: Rocket,
      title: "볼트 (Bolt) 참여",
      description: "구체적 과제를 해결하는 볼트에 참여하여 실무 경험을 쌓기",
      href: "/projects",
      cta: "볼트 탐색",
      color: "text-nu-blue",
      bg: "bg-nu-blue/5",
      border: "border-nu-blue/30",
    },
    {
      icon: BookOpen,
      title: "탭 (Tab) 탐색",
      description: "다른 팀이 쌓은 지식 아카이브를 둘러보며 영감 얻기",
      href: "/wiki",
      cta: "탭 둘러보기",
      color: "text-nu-amber",
      bg: "bg-nu-amber/5",
      border: "border-nu-amber/30",
    },
    {
      icon: Target,
      title: "의뢰 등록",
      description: "외부 프로젝트를 nutunion 팀에 의뢰하여 함께 해결",
      href: "/challenges",
      cta: "의뢰 하기",
      color: "text-green-700",
      bg: "bg-green-50",
      border: "border-green-300",
    },
  ];

  return (
    <section className="border-[2.5px] border-nu-ink bg-gradient-to-br from-nu-pink/5 via-nu-paper to-nu-blue/5 mb-6">
      <div className="p-5 border-b-[2px] border-nu-ink">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-nu-pink" />
          <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink font-bold">
            Welcome
          </span>
        </div>
        <h2 className="text-[20px] sm:text-[22px] font-bold text-nu-ink">
          안녕하세요 <span className="text-nu-pink">{nickname}</span>님 👋
        </h2>
        <p className="text-[13px] text-nu-graphite mt-1 leading-relaxed">
          nutunion 을 시작하는 방법을 알려드릴게요. 아래 중 하나를 선택해 첫 걸음을 떼보세요.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x-[2px] divide-nu-ink/10">
        {steps.map((s) => (
          <div key={s.title} className={`p-4 ${s.bg}`}>
            <div className="flex items-start gap-3 mb-2">
              <div className={`w-10 h-10 ${s.bg} border-[2px] ${s.border} flex items-center justify-center shrink-0`}>
                <s.icon size={18} className={s.color} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-[14px] text-nu-ink">{s.title}</h3>
                <p className="text-[12px] text-nu-graphite mt-0.5 leading-relaxed">{s.description}</p>
              </div>
            </div>
            <Link
              href={s.href}
              className={`inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest ${s.color} hover:underline no-underline mt-1`}
            >
              {s.cta} <ArrowRight size={11} />
            </Link>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t-[2px] border-nu-ink/10 bg-nu-cream/30 font-mono-nu text-[10px] text-nu-graphite">
        💡 아래 <strong className="text-nu-ink">오늘의 브리프</strong>에서 &quot;지금 뭐 해야 해?&quot; 를 물어보면 AI 가 다음 액션을 제안합니다.
      </div>
    </section>
  );
}
