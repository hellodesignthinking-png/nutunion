import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { dispatchPushToUsers } from "@/lib/push/dispatch";
import { STAGES } from "@/lib/venture/types";

export const runtime = "nodejs";

const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("select_problem"), problem_id: z.string().uuid() }),
  z.object({ action: z.literal("set_main_idea"),   idea_id: z.string().uuid() }),
  z.object({ action: z.literal("vote_idea"),       idea_id: z.string().uuid(), weight: z.number().int().min(1).max(3) }),
  z.object({ action: z.literal("unvote_idea"),     idea_id: z.string().uuid() }),
  z.object({ action: z.literal("toggle_task"),     task_id: z.string().uuid(), status: z.enum(["todo","doing","done"]) }),
  z.object({ action: z.literal("delete"),          entity: z.enum(["insight","problem","idea","task","feedback"]), id: z.string().uuid() }),
  z.object({ action: z.literal("set_stage"),       stage: z.enum(["empathize","define","ideate","prototype","plan","completed"]) }),
]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const d = parsed.data;

  try {
    switch (d.action) {
      case "select_problem":
        // 기존 선택 해제 → 새로 선택
        await supabase.from("venture_problems").update({ is_selected: false })
          .eq("project_id", projectId).eq("is_selected", true);
        await supabase.from("venture_problems").update({ is_selected: true })
          .eq("id", d.problem_id).eq("project_id", projectId);
        break;

      case "set_main_idea":
        await supabase.from("venture_ideas").update({ is_main: false })
          .eq("project_id", projectId).eq("is_main", true);
        await supabase.from("venture_ideas").update({ is_main: true })
          .eq("id", d.idea_id).eq("project_id", projectId);
        break;

      case "vote_idea":
        await supabase.from("venture_idea_votes").upsert({
          idea_id: d.idea_id,
          user_id: user.id,
          weight: d.weight,
        }, { onConflict: "idea_id,user_id" });
        break;

      case "unvote_idea":
        await supabase.from("venture_idea_votes").delete()
          .eq("idea_id", d.idea_id).eq("user_id", user.id);
        break;

      case "toggle_task":
        await supabase.from("venture_prototype_tasks").update({ status: d.status })
          .eq("id", d.task_id).eq("project_id", projectId);
        break;

      case "delete": {
        const tableMap: Record<string, string> = {
          insight: "venture_insights",
          problem: "venture_problems",
          idea: "venture_ideas",
          task: "venture_prototype_tasks",
          feedback: "venture_feedback",
        };
        await supabase.from(tableMap[d.entity]).delete().eq("id", d.id).eq("project_id", projectId);
        break;
      }

      case "set_stage": {
        // 현재 단계 조회 (전환 감지)
        const { data: currentProj } = await supabase
          .from("projects")
          .select("venture_stage, title")
          .eq("id", projectId)
          .maybeSingle();
        const prevStage = currentProj?.venture_stage as string | null;

        await supabase.from("projects").update({ venture_stage: d.stage }).eq("id", projectId);

        // 실제 전환이 일어났을 때만 푸시
        if (prevStage !== d.stage) {
          const { data: members } = await supabase
            .from("project_members")
            .select("user_id")
            .eq("project_id", projectId);
          const memberIds = [...new Set(((members as { user_id: string }[] | null) ?? []).map((m) => m.user_id))]
            .filter((uid) => uid !== user.id);  // 본인 제외

          if (memberIds.length > 0) {
            const stageLabel = STAGES.find((s) => s.id === d.stage)?.label ?? d.stage;
            const icon = STAGES.find((s) => s.id === d.stage)?.icon ?? "🚀";
            dispatchPushToUsers(memberIds, {
              title: `${icon} ${stageLabel} 단계로 전환`,
              body: `"${currentProj?.title ?? "볼트"}" 가 ${stageLabel} 단계로 이동했습니다.`,
              url: `/projects/${projectId}/venture`,
              tag: `venture-${projectId}`,
            }).catch(() => {});
          }
        }
        break;
      }
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "실패" }, { status: 500 });
  }
}
