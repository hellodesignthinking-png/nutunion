import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function AutomationApprovalsWidget() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  let pending = 0;
  try {
    const { count, error } = await supabase
      .from("automation_approvals")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .eq("status", "pending");
    if (error) {
      // migration not applied — degrade silently
      return null;
    }
    pending = count || 0;
  } catch {
    return null;
  }

  if (pending === 0) return null;

  return (
    <Link
      href="/settings/automations/approvals"
      className="inline-flex items-center gap-2 px-3 py-1 border-[3px] border-nu-ink bg-nu-pink text-white text-sm font-bold shadow-[3px_3px_0_#0D0D0D] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition"
    >
      ⏳ 자동화 승인 대기 {pending}건 →
    </Link>
  );
}
