"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, X, Rocket, BookOpen, Zap } from "lucide-react";

const iconMap: Record<string, React.ReactNode> = {
  rocket: <Rocket size={24} />,
  "book-open": <BookOpen size={24} />,
  zap: <Zap size={24} />,
};

interface TemplateCardProps {
  title: string;
  description: string;
  iconName: string;
  color: string;
  tag: string;
  templateId: string;
  details: {
    longDescription: string;
    features: string[];
    groupSize: string;
    duration: string;
  };
}

export function TemplateCard({
  title,
  description,
  iconName,
  color,
  tag,
  templateId,
  details,
}: TemplateCardProps) {
  const icon = iconMap[iconName] || <Rocket size={24} />;
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const handleStartTemplate = () => {
    router.push(`/groups/create?template=${templateId}`);
  };

  return (
    <>
      {/* Card */}
      <div
        onClick={() => setIsOpen(true)}
        className={`group relative p-6 border-2 transition-all hover:-translate-y-1 cursor-pointer overflow-hidden ${color} border-current`}
      >
        <div className="absolute top-0 right-0 p-4 opacity-10 scale-150 rotate-12 transition-transform group-hover:rotate-45">
          {icon}
        </div>
        <div className="relative z-10">
          <span className="font-mono-nu text-[9px] font-black tracking-widest px-2 py-1 bg-white border border-nu-ink/10 mb-4 inline-block">
            {tag}
          </span>
          <h3 className="font-head text-xl font-bold mb-2 group-hover:text-nu-ink">{title}</h3>
          <p className="text-[11px] leading-relaxed opacity-70 mb-6">{description}</p>
          <div className="flex items-center gap-2 font-mono-nu text-[10px] font-black uppercase tracking-widest">
            Apply This Template <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-nu-paper border-2 border-nu-ink max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className={`p-8 border-b-2 border-nu-ink/10 ${color} border-current`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <span className="font-mono-nu text-[9px] font-black tracking-widest px-2 py-1 bg-nu-ink text-nu-paper inline-block mb-4">
                    {tag}
                  </span>
                  <h2 className="font-head text-3xl font-black text-nu-ink mb-2">{title}</h2>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-nu-ink/10 transition-colors"
                  aria-label="Close modal"
                >
                  <X size={24} />
                </button>
              </div>
              <p className="text-[13px] text-nu-graphite leading-relaxed">
                {details.longDescription}
              </p>
            </div>

            {/* Content */}
            <div className="p-8">
              {/* Included Features */}
              <div className="mb-8">
                <h3 className="font-head text-lg font-bold text-nu-ink mb-4 uppercase tracking-tight">
                  포함된 기능
                </h3>
                <ul className="space-y-2">
                  {details.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="font-mono-nu text-[10px] font-bold text-nu-pink mt-0.5">✓</span>
                      <span className="text-[12px] text-nu-graphite">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4 mb-8 p-4 bg-nu-cream/30 border border-nu-ink/10">
                <div>
                  <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1">
                    권장 그룹 규모
                  </p>
                  <p className="font-head text-lg font-bold text-nu-ink">{details.groupSize}</p>
                </div>
                <div>
                  <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1">
                    예상 기간
                  </p>
                  <p className="font-head text-lg font-bold text-nu-ink">{details.duration}</p>
                </div>
              </div>

              {/* CTA Button */}
              <button
                onClick={handleStartTemplate}
                className="w-full font-mono-nu text-[11px] font-bold tracking-[0.08em] uppercase px-6 py-4 bg-nu-pink text-nu-paper hover:bg-nu-ink border-2 border-nu-pink hover:border-nu-ink transition-all"
              >
                이 템플릿으로 시작하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
