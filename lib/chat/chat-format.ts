/**
 * lib/chat/chat-format — 채팅 시간/날짜 포매터 + 메시지 그룹핑 헬퍼.
 */

/** 두 ISO 문자열이 같은 분(HH:MM)인지 (메시지 그룹핑용) */
export function sameMinute(a: string, b: string): boolean {
  try {
    const da = new Date(a);
    const db = new Date(b);
    return (
      da.getFullYear() === db.getFullYear() &&
      da.getMonth() === db.getMonth() &&
      da.getDate() === db.getDate() &&
      da.getHours() === db.getHours() &&
      da.getMinutes() === db.getMinutes()
    );
  } catch {
    return false;
  }
}

/** 날짜 구분선 레이블 — 오늘 / 어제 / YYYY.MM.DD (요일) */
export function dayLabel(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);
  if (diffDays === 0) return "오늘";
  if (diffDays === 1) return "어제";
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} (${days[d.getDay()]})`;
}

/** HH:mm 포맷 (ko) */
export function timeLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
