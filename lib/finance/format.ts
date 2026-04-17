/**
 * 재무 숫자/날짜 포매터
 */

/** 전체 숫자를 한국식 천단위 쉼표로 포맷 (예: 1,234,567) */
export function fmtKRW(n: number): string {
  return (n ?? 0).toLocaleString("ko-KR");
}

/** 큰 숫자를 억/만 단위로 축약 (카드 뷰용) */
export function fmtShort(n: number): string {
  const v = n ?? 0;
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 100000000) return `${sign}${(abs / 100000000).toFixed(1)}억`;
  if (abs >= 10000) return `${sign}${Math.floor(abs / 10000)}만`;
  return v.toLocaleString("ko-KR");
}

/** "YYYY-MM-DD" 형식 날짜를 "M월 D일" 로 변환 */
export function fmtShortDate(date: string | undefined | null): string {
  if (!date) return "-";
  const parts = date.split("-");
  if (parts.length !== 3) return date;
  return `${Number(parts[1])}월 ${Number(parts[2])}일`;
}

/** "YYYY-MM" 형식을 "YYYY년 M월" 로 변환 */
export function fmtYearMonth(ym: string | undefined | null): string {
  if (!ym) return "-";
  const parts = ym.split("-");
  if (parts.length !== 2) return ym;
  return `${parts[0]}년 ${Number(parts[1])}월`;
}

/** 퍼센트 포맷 (1자리 소수점) */
export function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

/** 상대 시간 포맷 (예: "방금", "3분 전", "2일 전", "2026-04-01") */
export function fmtRelativeTime(date: string | Date | undefined | null): string {
  if (!date) return "-";
  const target = typeof date === "string" ? new Date(date) : date;
  if (isNaN(target.getTime())) return "-";
  const diff = Date.now() - target.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "방금";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  if (day < 30) return `${Math.floor(day / 7)}주 전`;
  return target.toISOString().slice(0, 10);
}
