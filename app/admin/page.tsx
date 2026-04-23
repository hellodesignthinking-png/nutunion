import { redirect } from "next/navigation";

// /admin → Overview 로 영구 리다이렉트.
// 기존 대시보드 내용은 legacy-dashboard.tsx.bak 에 백업.
export default function AdminRootRedirect() {
  redirect("/admin/overview");
}
