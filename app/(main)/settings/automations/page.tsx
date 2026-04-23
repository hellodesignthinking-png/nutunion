import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AUTOMATION_TEMPLATES } from "@/lib/automation/templates";
import { AutomationsClient } from "@/components/automation/automations-client";

export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Load active rules (graceful degradation if migration not applied)
  let rules: any[] = [];
  let migrationMissing = false;
  try {
    const { data, error } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      if (/relation .* does not exist/i.test(error.message)) migrationMissing = true;
    } else {
      rules = data || [];
    }
  } catch {
    migrationMissing = true;
  }

  // Load user's groups/projects for scope picker
  const { data: groupMemberships } = await supabase
    .from("group_members")
    .select("group_id, groups(id, name)")
    .eq("user_id", user.id)
    .eq("status", "active");
  const { data: projectMemberships } = await supabase
    .from("project_members")
    .select("project_id, projects(id, title)")
    .eq("user_id", user.id);

  const groups = (groupMemberships || [])
    .map((m: any) => m.groups)
    .filter(Boolean) as { id: string; name: string }[];
  const projects = (projectMemberships || [])
    .map((m: any) => m.projects)
    .filter(Boolean) as { id: string; title: string }[];

  // Pending approvals count
  let pendingCount = 0;
  try {
    const { count } = await supabase
      .from("automation_approvals")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .eq("status", "pending");
    pendingCount = count || 0;
  } catch {
    /* ignore */
  }

  return (
    <div className="min-h-screen bg-nu-paper p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black text-nu-ink">🤖 Nut-mation Rule Library</h1>
            <p className="mt-1 text-sm text-nu-ink/60">
              검증된 템플릿을 바로 활성화하거나, 직접 트리거+액션을 조합해 커스텀 룰을 만드세요.
            </p>
          </div>
          <Link
            href="/settings/automations/builder"
            className="shrink-0 px-3 py-2 border-[3px] border-nu-ink bg-nu-pink text-white font-bold text-sm shadow-[3px_3px_0_#0D0D0D] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition"
          >
            🛠️ 커스텀 빌더
          </Link>
        </div>
        {pendingCount > 0 && (
          <Link
            href="/settings/automations/approvals"
            className="inline-block mt-3 px-3 py-1 border-[3px] border-nu-ink bg-nu-pink text-white font-bold text-sm shadow-[3px_3px_0_#0D0D0D] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition"
          >
            ⏳ 자동화 승인 대기 {pendingCount}건 →
          </Link>
        )}
      </header>

      {migrationMissing && (
        <div className="mb-6 p-4 border-[3px] border-nu-ink bg-yellow-100">
          <p className="font-bold">마이그레이션 적용 필요</p>
          <p className="text-sm mt-1">
            Supabase 에 <code className="bg-white px-1">supabase/migrations/106_automation.sql</code> 을 적용한 뒤 이 페이지를 다시 열어주세요.
          </p>
        </div>
      )}

      <AutomationsClient
        templates={AUTOMATION_TEMPLATES}
        initialRules={rules}
        groups={groups}
        projects={projects}
        disabled={migrationMissing}
      />
    </div>
  );
}
