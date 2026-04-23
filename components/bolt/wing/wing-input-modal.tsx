"use client";

/**
 * WingInputModal — Wing Bolt 전용 일일 진도 입력.
 *
 * 필드:
 *  - 오늘 참석 / 판매 / 가입 등 (goal_metric 에 따라 라벨 변함)
 *  - 채널별 기여 (여러 값)
 *  - 메모
 *
 * 저장: bolt_metrics (period_type='daily')
 */

import { useEffect, useState } from "react";
import { X, Loader2, CheckCircle2, Megaphone } from "lucide-react";
import { toast } from "sonner";

interface Channel {
  name: string;
  value: number;
}

interface Props {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  /** 캠페인 기본 지표 명 (Wing.goal_metric, 예: "참석자", "매출", "가입") */
  goalMetric?: string | null;
  /** 미리 정의된 채널 목록 (Wing.channels) — 입력 폼에 자동으로 채움 */
  predefinedChannels?: Array<{ name: string }>;
  /** 오늘 날짜 (default: today) */
  date?: string;
  /** 기존 입력 prefill */
  initial?: { value?: number; channels?: Channel[]; memo?: string };
}

export function WingInputModal({
  projectId,
  isOpen,
  onClose,
  onSaved,
  goalMetric,
  predefinedChannels,
  date,
  initial,
}: Props) {
  const today = date || new Date().toISOString().slice(0, 10);
  const [value, setValue] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setValue(initial?.value ? String(initial.value) : "");
    setMemo(initial?.memo || "");
    if (initial?.channels && initial.channels.length > 0) {
      setChannels(initial.channels);
    } else if (predefinedChannels && predefinedChannels.length > 0) {
      setChannels(predefinedChannels.map((c) => ({ name: c.name, value: 0 })));
    } else {
      setChannels([
        { name: "SNS", value: 0 },
        { name: "오프라인", value: 0 },
        { name: "지인초대", value: 0 },
      ]);
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  function updateChannel(i: number, patch: Partial<Channel>) {
    setChannels((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function addChannel() {
    setChannels((cs) => [...cs, { name: "새 채널", value: 0 }]);
  }
  function removeChannel(i: number) {
    setChannels((cs) => cs.filter((_, idx) => idx !== i));
  }

  const total = Number(value) || channels.reduce((s, c) => s + Number(c.value || 0), 0);
  const metricLabel = goalMetric || "진도";

  async function save() {
    if (total === 0) {
      toast.error(`오늘 ${metricLabel} 값을 입력해주세요`);
      return;
    }
    setSaving(true);
    try {
      // channel shape → {sns: 45, offline: 12, ...}
      const channelMap: Record<string, number> = {};
      for (const c of channels) {
        const key = c.name.toLowerCase().replace(/\s+/g, "_");
        if (key) channelMap[key] = Number(c.value) || 0;
      }

      const res = await fetch(`/api/bolts/${projectId}/metrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_type: "daily",
          period_start: today,
          metrics: {
            // 주 지표 — 숫자 하나
            value: total,
            // 명시적 매핑
            attendance: goalMetric?.includes("참석") ? total : undefined,
            sales: goalMetric?.includes("매출") ? total : undefined,
            signups: goalMetric?.includes("가입") ? total : undefined,
            channel: channelMap,
          },
          memo: memo.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "저장 실패");
      toast.success("진도 저장됨");
      onSaved?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const dateLabel = new Date(today + "T00:00:00").toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="캠페인 진도 입력"
        className="w-full sm:max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-y-auto bg-white rounded-t-[var(--ds-radius-xl)] sm:rounded-[var(--ds-radius-xl)] border border-[color:var(--neutral-100)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--neutral-100)] sticky top-0 bg-white z-10">
          <div>
            <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-green-700 font-bold inline-flex items-center gap-1">
              <Megaphone size={11} /> Campaign Progress
            </div>
            <div className="text-[14px] font-semibold text-[color:var(--neutral-900)]">{dateLabel}</div>
          </div>
          <button onClick={onClose} aria-label="닫기" className="p-1.5 hover:bg-[color:var(--neutral-50)] rounded">
            <X size={18} />
          </button>
        </header>

        <div className="p-5 space-y-5">
          {/* 오늘 총 */}
          <section>
            <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite font-bold mb-1">
              오늘 누적 {metricLabel}
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder={`오늘 달성한 ${metricLabel} 수치`}
              className="w-full px-3 py-2.5 border-[1.5px] border-[color:var(--neutral-200)] rounded-[var(--ds-radius-md)] focus:border-green-600 outline-none text-[16px] font-mono-nu tabular-nums font-bold"
            />
            <p className="text-[11px] text-nu-muted mt-1">
              채널별 합계로 자동 계산되거나, 직접 입력할 수 있어요.
            </p>
          </section>

          {/* 채널별 */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite font-bold">
                채널별 기여
              </label>
              <button
                onClick={addChannel}
                className="text-[10px] font-mono-nu uppercase tracking-widest text-green-700 hover:underline"
              >
                + 채널 추가
              </button>
            </div>
            <div className="space-y-1.5">
              {channels.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={c.name}
                    onChange={(e) => updateChannel(i, { name: e.target.value })}
                    className="flex-1 px-2 py-1.5 border-[1.5px] border-[color:var(--neutral-200)] rounded text-[12px]"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={c.value || ""}
                    onChange={(e) => updateChannel(i, { value: Number(e.target.value.replace(/[^\d]/g, "")) || 0 })}
                    placeholder="0"
                    className="w-24 px-2 py-1.5 border-[1.5px] border-[color:var(--neutral-200)] rounded text-[13px] font-mono-nu tabular-nums text-right"
                  />
                  <button
                    onClick={() => removeChannel(i)}
                    className="text-nu-muted hover:text-nu-pink p-1"
                    aria-label="삭제"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] font-mono-nu pt-1 border-t border-dashed border-nu-ink/10">
              <span className="text-nu-graphite">채널 합계</span>
              <span className="font-bold text-nu-ink tabular-nums">
                {channels.reduce((s, c) => s + Number(c.value || 0), 0).toLocaleString("ko-KR")}
              </span>
            </div>
          </section>

          {/* 메모 */}
          <section>
            <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite font-bold block mb-2">
              메모 (선택)
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              placeholder="오늘 특이사항, 피드백, 이벤트 등"
              className="w-full px-3 py-2 border-[1.5px] border-[color:var(--neutral-200)] rounded-[var(--ds-radius-md)] focus:border-green-600 outline-none text-[13px] resize-none"
            />
          </section>

          {/* 요약 */}
          <section className="p-3 bg-green-50 border-l-[3px] border-green-600 rounded-r">
            <div className="flex justify-between items-baseline">
              <span className="font-mono-nu text-[10px] uppercase tracking-widest text-green-700 font-bold">
                오늘 {metricLabel}
              </span>
              <span className="font-head text-[22px] font-extrabold text-green-700 tabular-nums">
                {total.toLocaleString("ko-KR")}
              </span>
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-between gap-2 p-4 border-t border-[color:var(--neutral-100)] sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-[color:var(--neutral-200)] rounded-[var(--ds-radius-md)] text-[13px] font-medium"
          >
            취소
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-green-700 text-white rounded-[var(--ds-radius-md)] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" /> 저장 중
              </>
            ) : (
              <>
                <CheckCircle2 size={14} /> 진도 저장
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
