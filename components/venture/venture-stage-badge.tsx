import { STAGES, type VentureStage } from "@/lib/venture/types";

interface Props {
  ventureMode: boolean;
  ventureStage: string | null;
  completed?: boolean;
  /** 'sm' — 카드용 작은 뱃지 / 'md' — 헤더용 */
  size?: "sm" | "md";
}

/**
 * 볼트 카드 / 헤더에 표시되는 Venture 진행 뱃지.
 * 모드 비활성화 = 렌더링 안 함.
 */
export function VentureStageBadge({ ventureMode, ventureStage, completed, size = "sm" }: Props) {
  if (!ventureMode) return null;

  const stage = STAGES.find((s) => s.id === ventureStage);
  const currentIdx = STAGES.findIndex((s) => s.id === ventureStage);
  const total = STAGES.length;
  const progress = currentIdx >= 0 ? ((currentIdx + 1) / total) * 100 : 0;
  const isDone = completed || ventureStage === "completed";

  const base = size === "sm"
    ? "h-5 text-[9px] px-1.5"
    : "h-7 text-[10px] px-2";

  return (
    <span
      className={`inline-flex items-center gap-1.5 border-[1.5px] border-nu-pink bg-nu-pink/10 text-nu-pink font-mono-nu uppercase tracking-wider ${base}`}
      title={`Venture · ${stage?.short ?? "?"} (${Math.round(progress)}%)`}
    >
      <span>🚀</span>
      {isDone ? (
        <span className="font-bold">COMPLETED</span>
      ) : (
        <>
          <span className="font-bold">{stage?.label ?? "?"}</span>
          <span className="hidden sm:inline opacity-70">{currentIdx + 1}/{total}</span>
        </>
      )}
    </span>
  );
}
