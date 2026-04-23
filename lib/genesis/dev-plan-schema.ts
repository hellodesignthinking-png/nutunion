/**
 * Genesis "기술 개발" dev-plan zod schema.
 *
 * SecondWind-level output shape for platform / app / MVP projects.
 * Consumed by:
 *   - POST /api/genesis/dev-plan  (generation)
 *   - /projects/[id]/dev-plan     (rendering)
 *   - projects.dev_plan JSONB     (storage)
 */

import { z } from "zod";

export const DevPlanSchema = z.object({
  project_name: z.string(),
  mvp_target: z.string(),
  recommended_weeks: z.number().min(1).max(52),
  recommended_team_size: z.number().min(1).max(30),
  target_launch: z.string(),

  strategic_decisions: z
    .array(
      z.object({
        platform: z.enum(["pc_web", "mobile_app", "admin", "api", "landing"]),
        priority: z.enum(["high", "medium", "low", "skip"]),
        rationale: z.string(),
      }),
    )
    .min(1)
    .max(6),

  effort_breakdown: z
    .array(
      z.object({
        area: z.enum(["infra", "backend", "frontend", "ai", "qa", "devops"]),
        tasks: z
          .array(
            z.object({
              title: z.string(),
              estimated_days: z.number().min(0.5).max(60),
              depends_on: z.array(z.string()).optional(),
            }),
          )
          .min(1),
      }),
    )
    .min(1),

  gantt: z
    .array(
      z.object({
        week: z.number().min(1).max(52),
        milestones: z.array(z.string()).max(4),
        parallel_tracks: z.array(z.string()).max(6),
      }),
    )
    .min(1),

  team_scenarios: z
    .array(
      z.object({
        name: z.string(),
        size: z.number().min(1).max(30),
        duration_weeks: z.number().min(1).max(52),
        trade_offs: z.string(),
        roles: z
          .array(
            z.object({
              role: z.string(),
              availability: z.enum(["internal", "external_hire", "outsource"]),
              note: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .min(1)
    .max(5),

  risks: z
    .array(
      z.object({
        category: z.enum([
          "technical",
          "external_api",
          "security",
          "talent",
          "scope",
          "budget",
        ]),
        description: z.string(),
        severity: z.enum(["low", "medium", "high"]),
        mitigation: z.string(),
      }),
    )
    .max(12),

  quick_wins: z
    .array(
      z.union([
        z.string(),
        z.object({
          title: z.string(),
          shortens_weeks: z.number().optional(),
          note: z.string().optional(),
        }),
      ]),
    )
    .max(10),
  tech_stack: z.array(z.string()).max(20),
});

export type DevPlan = z.infer<typeof DevPlanSchema>;

export const DEV_KEYWORDS = [
  "플랫폼",
  "앱",
  "개발",
  "서비스",
  "MVP",
  "시스템",
  "app",
  "platform",
  "mvp",
  "system",
  "saas",
  "웹",
];

export function matchesDevIntent(intent: string): boolean {
  const s = (intent || "").toLowerCase();
  return DEV_KEYWORDS.some((k) => s.includes(k.toLowerCase()));
}
