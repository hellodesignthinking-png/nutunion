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
