import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TRIGGERS, ACTIONS } from "@/lib/automation/palette";
import { BuilderClient } from "@/components/automation/builder-client";

export const dynamic = "force-dynamic";

export default async function AutomationsBuilderPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Check if migration 106 is applied
  let migrationMissing = false;
  try {
    const { error } = await supabase
      .from("automation_rules")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id);
    if (error && /relation .* does not exist/i.test(error.message)) {
      migrationMissing = true;
    }
  } catch {
    migrationMissing = true;
  }

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

  return (
    <div className="min-h-screen bg-nu-paper p-6 max-w-7xl mx-auto">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-nu-ink">🛠️ 커스텀 룰 빌더</h1>
          <p className="mt-1 text-sm text-nu-ink/60">
            트리거 1개 + 액션 최대 5개를 조합해 나만의 자동화 룰을 만들어보세요.
          </p>
        </div>
        <Link
          href="/settings/automations"
          className="px-3 py-2 border-[3px] border-nu-ink bg-white font-bold text-sm shadow-[3px_3px_0_#0D0D0D] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition"
        >
          ← 라이브러리
        </Link>
      </header>

      {migrationMissing && (
        <div className="mb-6 p-4 border-[3px] border-nu-ink bg-yellow-100">
          <p className="font-bold">마이그레이션 적용 필요</p>
          <p className="text-sm mt-1">
            Supabase 에 <code className="bg-white px-1">106_automation.sql</code> 을 먼저 적용해주세요.
          </p>
        </div>
      )}

      <BuilderClient
        triggers={TRIGGERS}
        actions={ACTIONS}
        groups={groups}
        projects={projects}
        disabled={migrationMissing}
      />
    </div>
  );
}
