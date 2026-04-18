import { STAGES, type StageProgress } from "@/lib/venture/types";

export function VentureStageTracker({
  progress,
  currentStage,
}: {
  progress: StageProgress[];
  currentStage: string;
}) {
  return (
    <div className="border-[2.5px] border-nu-ink bg-nu-paper">
      <div className="grid grid-cols-5 divide-x-[2px] divide-nu-ink">
        {STAGES.map((s, i) => {
          const p = progress[i];
          const isCurrent = currentStage === s.id;
          const status = p.complete ? "complete" : isCurrent ? "current" : i === 0 || progress[i - 1].complete ? "available" : "locked";
          return (
            <div
              key={s.id}
              className={`p-3 sm:p-4 flex flex-col items-center text-center relative ${
                status === "complete"
                  ? "bg-nu-pink/5"
                  : status === "current"
                  ? "bg-nu-pink text-nu-paper"
                  : status === "locked"
                  ? "opacity-50"
                  : ""
              }`}
            >
              <div className="text-[24px] sm:text-[28px] mb-1">{s.icon}</div>
              <div className={`font-mono-nu text-[9px] uppercase tracking-[0.1em] ${status === "current" ? "text-nu-paper" : "text-nu-graphite"}`}>
                {i + 1}. {s.short}
              </div>
              <div className={`font-bold text-[13px] sm:text-[15px] mt-0.5 ${status === "current" ? "text-nu-paper" : "text-nu-ink"}`}>
                {s.label}
              </div>
              <div className={`text-[10px] mt-1 ${status === "current" ? "text-nu-paper/80" : "text-nu-graphite"}`}>
                {status === "complete" ? "✓ 완료" : status === "current" ? "🏃 진행 중" : status === "locked" ? "🔒 잠금" : "대기"}
              </div>
              <div className={`text-[9px] mt-0.5 font-mono-nu ${status === "current" ? "text-nu-paper/80" : "text-nu-graphite"} hidden sm:block truncate max-w-full`}>
                {p.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
