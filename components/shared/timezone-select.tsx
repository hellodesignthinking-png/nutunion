"use client";

/**
 * TimezoneSelect — 자주 쓰는 IANA 타임존 + Intl 로 사용자 브라우저 기본값.
 * 회의/이벤트 생성 시 +09:00 하드코딩 제거.
 *
 * 저장 형식: IANA 이름 (예: 'Asia/Seoul'). 서버에서 startAt 을 toISOString() 으로
 * UTC 변환해 저장하므로 IANA 이름은 메타로만 보관 (events.timezone 컬럼 등) 또는 클라이언트
 * 변환에 사용.
 */

import { useState } from "react";

const COMMON: Array<{ tz: string; label: string }> = [
  { tz: "Asia/Seoul", label: "서울 / 도쿄 (KST/JST · UTC+9)" },
  { tz: "Asia/Shanghai", label: "베이징 / 홍콩 / 싱가포르 (CST · UTC+8)" },
  { tz: "Asia/Bangkok", label: "방콕 / 자카르타 (UTC+7)" },
  { tz: "Asia/Kolkata", label: "인도 (IST · UTC+5:30)" },
  { tz: "Asia/Dubai", label: "두바이 (GST · UTC+4)" },
  { tz: "Europe/London", label: "런던 (GMT/BST · UTC+0/1)" },
  { tz: "Europe/Paris", label: "파리 / 베를린 / 로마 (CET/CEST · UTC+1/2)" },
  { tz: "America/New_York", label: "뉴욕 (EST/EDT · UTC-5/-4)" },
  { tz: "America/Chicago", label: "시카고 (CST/CDT · UTC-6/-5)" },
  { tz: "America/Denver", label: "덴버 (MST/MDT · UTC-7/-6)" },
  { tz: "America/Los_Angeles", label: "로스앤젤레스 (PST/PDT · UTC-8/-7)" },
  { tz: "Australia/Sydney", label: "시드니 (AEST/AEDT · UTC+10/11)" },
  { tz: "Pacific/Auckland", label: "오클랜드 (NZST/NZDT · UTC+12/13)" },
];

function detectBrowserTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul";
  } catch {
    return "Asia/Seoul";
  }
}

export interface TimezoneSelectProps {
  value: string;
  onChange: (tz: string) => void;
  className?: string;
}

export function TimezoneSelect({ value, onChange, className = "" }: TimezoneSelectProps) {
  const browserTz = detectBrowserTz();
  // 흔하지 않은 브라우저 기본값도 보여주기 위해 동적 추가
  const [extra] = useState<Array<{ tz: string; label: string }>>(() => {
    if (COMMON.some((c) => c.tz === browserTz)) return [];
    return [{ tz: browserTz, label: `${browserTz} (브라우저 기본)` }];
  });

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`px-2 py-1.5 border-2 border-nu-ink/15 text-sm font-mono-nu bg-nu-paper outline-none focus:border-nu-ink ${className}`}
    >
      {extra.map((c) => (
        <option key={c.tz} value={c.tz}>{c.label}</option>
      ))}
      {COMMON.map((c) => (
        <option key={c.tz} value={c.tz}>{c.label}</option>
      ))}
    </select>
  );
}

/**
 * 로컬 날짜+시각(YYYY-MM-DD + HH:MM) 을 지정 타임존 기준으로 ISO(UTC) 변환.
 * 서버에 timestamptz 로 저장할 때 사용.
 *
 * 동작 원리: 입력을 우선 그 시각의 UTC 로 가정 후 그 차이만큼 보정 — 결과적으로
 * 그 IANA 타임존의 wall-clock 시각을 정확히 표현하는 UTC ISO 가 나옴.
 */
export function localToZonedISO(date: string, time: string, tz: string): string {
  // 'YYYY-MM-DDTHH:MM:00' 을 그 타임존의 wall clock 으로 해석
  const [Y, M, D] = date.split("-").map(Number);
  const [h, m] = time.split(":").map(Number);

  // UTC 로 1차 가정
  const utcGuess = Date.UTC(Y, M - 1, D, h, m, 0);

  // 그 시각이 tz 에서 표시될 때 차이 (분) — Intl 로 추출
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(new Date(utcGuess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const tzMs = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));

  // 차이만큼 보정해서 입력 wall-clock 을 UTC 로 매핑
  const offset = utcGuess - tzMs;
  return new Date(utcGuess + offset).toISOString();
}

export function defaultTimezone(): string {
  return detectBrowserTz();
}
