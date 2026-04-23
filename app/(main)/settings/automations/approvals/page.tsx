import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ApprovalsClient } from "@/components/automation/approvals-client";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let approvals: any[] = [];
  let migrationMissing = false;
  try {
    const { data, error } = await supabase
      .from("automation_approvals")
      .select("*")
      .eq("owner_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) {
      if (/relation .* does not exist/i.test(error.message)) migrationMissing = true;
    } else {
      approvals = data || [];
    }
  } catch {
    migrationMissing = true;
  }

  return (
    <div className="min-h-screen bg-nu-paper p-6 max-w-3xl mx-auto">
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <Link href="/settings/automations" className="text-sm underline">
            ← 룰 라이브러리
          </Link>
        </div>
        <h1 className="text-3xl font-black text-nu-ink mt-2">⏳ 자동화 승인 대기</h1>
        <p className="text-sm text-nu-ink/60 mt-1">AI 가 제안한 액션을 검토하고 승인하거나 거절할 수 있어요.</p>
      </header>

      {migrationMissing && (
        <div className="mb-6 p-4 border-[3px] border-nu-ink bg-yellow-100">
          <p className="font-bold">마이그레이션 적용 필요</p>
          <p className="text-sm mt-1">migration 106_automation.sql 적용 후 이용 가능합니다.</p>
        </div>
      )}

      <ApprovalsClient initialApprovals={approvals} />
    </div>
  );
}
