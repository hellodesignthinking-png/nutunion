"use client";

/**
 * MissingInputAlert — 최근 7일 중 미입력 일수가 많으면 경고.
 *
 * - 0~1일: 표시 없음
 * - 2일: 연한 경고 (yellow)
 * - 3일+: 강한 경고 (red)
 */

import { AlertTriangle, Clock } from "lucide-react";

interface Props {
  dailyDates: string[];       // 입력된 날짜 목록 (YYYY-MM-DD)
  onOpenInput: () => void;
}

export function MissingInputAlert({ dailyDates, onOpenInput }: Props) {
  // 최근 7일 중 입력 안 된 일수 계산 (오늘 제외, 어제부터 6일 전까지)
  const entered = new Set(dailyDates);
  const missing: string[] = [];
  const now = new Date();
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (!entered.has(key)) missing.push(key);
  }

  if (missing.length < 2) return null;

  const severe = missing.length >= 3;
  const color = severe
    ? "bg-red-50 border-red-400 text-red-800"
    : "bg-yellow-50 border-yellow-400 text-yellow-800";
  const iconColor = severe ? "text-red-600" : "text-yellow-600";

  const labels = missing
    .slice(0, 3)
    .map((d) => new Date(d + "T00:00:00").toLocaleDateString("ko", { month: "numeric", day: "numeric" }))
    .join(", ");

  return (
    <div className={`border-l-[4px] ${color} p-3 rounded flex items-start gap-3`}>
      <AlertTriangle size={16} className={`${iconColor} mt-0.5 shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="font-mono-nu text-[10px] uppercase tracking-widest font-bold">
          {severe ? "🚨 " : "⚠️ "}최근 {missing.length}일 마감 미입력
        </div>
        <p className="text-[12px] leading-[1.6] mt-0.5">
          누락 날짜: <strong className="tabular-nums">{labels}</strong>
          {missing.length > 3 && ` 외 ${missing.length - 3}일`}.
          <br />
          <span className="opacity-80">
            주간 P&L 정확도를 위해 가능한 빨리 입력해주세요.
          </span>
        </p>
      </div>
      <button
        onClick={onOpenInput}
        className={`shrink-0 text-[11px] font-mono-nu uppercase tracking-widest font-bold px-3 py-1.5 border-[1.5px] rounded hover:bg-white/50 inline-flex items-center gap-1 ${severe ? "border-red-400" : "border-yellow-500"}`}
      >
        <Clock size={11} /> 입력
      </button>
    </div>
  );
}
