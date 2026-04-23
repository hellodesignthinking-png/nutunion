/**
 * lib/time-kst — Korea Standard Time (UTC+9) 기준 날짜 경계 유틸.
 *
 * 왜 필요한가:
 *   서비스가 한국 사용자 대상이고 DB `scheduled_at`, `start_at` 은 UTC 타임스탬프로 저장.
 *   "오늘 이후의 일정" 을 조회할 때 단순히 `new Date().toISOString()` 을 쓰면
 *   자정 무렵 시각차 때문에 오늘 일정이 빠지거나 내일 일정으로 표시되는 버그 발생.
 *
 *   `new Date(y, m, d).toISOString()` 도 위험 — 로컬 타임존의 자정을 Date 객체로 만들고
 *   toISOString 으로 UTC 로 변환하므로, 서버가 UTC 존에서 돌면 "오늘 자정" 이 틀림.
 *
 * 해결: KST 기준 연/월/일을 명시적으로 계산해서 UTC Date 를 수학적으로 조립.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 현재 KST 기준 Y/M/D 를 반환 (UTC-offset 과 무관) */
function kstYmd(now: Date = new Date()): { y: number; m: number; d: number } {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return {
    y: kst.getUTCFullYear(),
    m: kst.getUTCMonth(),
    d: kst.getUTCDate(),
  };
}

/** KST 오늘 자정 (00:00 KST) 을 UTC ISO 로 */
export function kstTodayStartISO(now: Date = new Date()): string {
  const { y, m, d } = kstYmd(now);
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - KST_OFFSET_MS).toISOString();
}

/** KST 오늘 끝 (24:00 KST = 내일 00:00 KST) 을 UTC ISO 로 */
export function kstTodayEndISO(now: Date = new Date()): string {
  const { y, m, d } = kstYmd(now);
  return new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0) - KST_OFFSET_MS).toISOString();
}

/** KST 기준 n일 후 자정을 UTC ISO 로 */
export function kstDaysLaterISO(days: number, now: Date = new Date()): string {
  const { y, m, d } = kstYmd(now);
  return new Date(Date.UTC(y, m, d + days, 0, 0, 0, 0) - KST_OFFSET_MS).toISOString();
}

/** 현재 시각 (KST 무관한 절대 현재 — UTC ISO) */
export function nowISO(): string {
  return new Date().toISOString();
}

/** KST 기준 target 날짜까지 남은 일수 (오늘=0, 내일=1, 어제=-1). null 안전. */
export function daysUntilKST(target: string | Date | null | undefined, now: Date = new Date()): number | null {
  if (!target) return null;
  const toKstMidnightMs = (d: Date): number => {
    const shifted = new Date(d.getTime() + KST_OFFSET_MS);
    return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  };
  const t = target instanceof Date ? target : new Date(target);
  if (isNaN(t.getTime())) return null;
  return Math.round((toKstMidnightMs(t) - toKstMidnightMs(now)) / 86400000);
}
