export function formatDate(date: string | Date, style: "short" | "medium" | "long" = "medium"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  switch (style) {
    case "short":
      return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
    case "long":
      return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
    case "medium":
    default:
      return d.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
  }
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
