import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GenesisPlanView } from "@/components/genesis/genesis-plan-view";

export const dynamic = "force-dynamic";

export default async function GroupGenesisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  let gp: any = null;
  try {
    const res = await supabase
      .from("genesis_plans")
      .select("id, plan, intent, model_used, created_at, target_id, target_kind")
      .eq("target_kind", "group")
      .eq("target_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    gp = res.data;
  } catch {
    notFound();
  }

  if (!gp) notFound();

  return (
    <GenesisPlanView
      kind="group"
      targetId={id}
      intent={gp.intent}
      plan={gp.plan}
      modelUsed={gp.model_used}
      createdAt={gp.created_at}
    />
  );
}
