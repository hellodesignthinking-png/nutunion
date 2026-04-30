import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AIPreferencesClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AIPreferencesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: prof } = await supabase
    .from("profiles")
    .select("ai_preferences")
    .eq("id", user.id)
    .maybeSingle();

  const prefs = (prof?.ai_preferences as any) || { enabled: true, features: ["summarize", "extract_actions", "recommend", "cross_thread_alert", "thread_recommend"] };

  return (
    <div className="min-h-screen bg-nu-cream/20 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="font-head text-2xl font-extrabold text-nu-ink">AI 환경설정</h1>
        <p className="text-sm font-mono text-nu-muted">AI 가 무엇을 도와줄지 직접 정합니다. 모든 변경은 즉시 반영됩니다.</p>
        <AIPreferencesClient initial={prefs} />
      </div>
    </div>
  );
}
