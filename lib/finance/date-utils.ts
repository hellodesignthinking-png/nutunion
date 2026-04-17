/**
 * YYYY-MM 포맷을 검증하고 [year, month(1-12)] 튜플 반환.
 * 잘못된 입력은 현재 월로 fallback.
 */
export function parseYearMonth(input: string | undefined): { ym: string; y: number; m: number } {
  const now = new Date();
  const match = input?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    if (m >= 1 && m <= 12 && y >= 2000 && y <= 2100) {
      return { ym: input!, y, m };
    }
  }
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return { ym: `${y}-${String(m).padStart(2, "0")}`, y, m };
}

/**
 * 해당 월의 첫 날 YYYY-MM-01 반환
 */
export function firstDayOfMonth(ym: string): string {
  return `${ym}-01`;
}

/**
 * 해당 월의 마지막 날 YYYY-MM-DD 반환 (month는 1-12)
 */
export function lastDayOfMonth(y: number, m: number): string {
  const lastDay = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/**
 * 이전/다음 월 계산 (ym 형식)
 */
export function prevMonth(y: number, m: number): string {
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function nextMonth(y: number, m: number): string {
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * 프리셋 날짜 범위 계산
 */
export type DatePreset = "this_month" | "last_month" | "this_quarter" | "this_year" | "last_3_months" | "last_6_months";

export function resolvePreset(preset: string | undefined): { fromDate: string; toDate: string; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-11
  const d = now.getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;

  switch (preset) {
    case "last_month": {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      return { fromDate: iso(start), toDate: iso(end), label: "지난달" };
    }
    case "this_quarter": {
      const qStart = Math.floor(m / 3) * 3;
      const start = new Date(y, qStart, 1);
      return { fromDate: iso(start), toDate: iso(now), label: "이번 분기" };
    }
    case "this_year": {
      const start = new Date(y, 0, 1);
      return { fromDate: iso(start), toDate: iso(now), label: "올해" };
    }
    case "last_3_months": {
      const start = new Date(y, m - 2, 1);
      return { fromDate: iso(start), toDate: iso(now), label: "최근 3개월" };
    }
    case "last_6_months": {
      const start = new Date(y, m - 5, 1);
      return { fromDate: iso(start), toDate: iso(now), label: "최근 6개월" };
    }
    case "this_month":
    default: {
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      return { fromDate: iso(start), toDate: iso(end), label: `${y}년 ${m + 1}월` };
    }
  }
  void d; // 사용 안하는 변수 경고 방지
}

export const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: "this_month", label: "이달" },
  { key: "last_month", label: "지난달" },
  { key: "last_3_months", label: "3개월" },
  { key: "last_6_months", label: "6개월" },
  { key: "this_quarter", label: "이번 분기" },
  { key: "this_year", label: "올해" },
];
