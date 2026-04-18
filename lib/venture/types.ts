export type VentureStage = "empathize" | "define" | "ideate" | "prototype" | "plan" | "completed";

export const STAGES: { id: VentureStage; label: string; short: string; icon: string }[] = [
  { id: "empathize", label: "공감", short: "Empathize", icon: "👂" },
  { id: "define", label: "정의", short: "Define", icon: "🎯" },
  { id: "ideate", label: "아이디어", short: "Ideate", icon: "💡" },
  { id: "prototype", label: "프로토타입", short: "Prototype", icon: "🛠" },
  { id: "plan", label: "사업계획", short: "Plan", icon: "📑" },
];

export interface VentureInsight {
  id: string;
  project_id: string;
  author_id: string | null;
  source: "interview" | "observation" | "survey" | "research" | "other";
  quote: string;
  pain_point: string | null;
  target_user: string | null;
  tags: string[];
  created_at: string;
}

export interface VentureProblem {
  id: string;
  project_id: string;
  author_id: string | null;
  hmw_statement: string;
  target_user: string | null;
  context: string | null;
  success_metric: string | null;
  is_selected: boolean;
  created_at: string;
}

export interface VentureIdea {
  id: string;
  project_id: string;
  author_id: string | null;
  title: string;
  description: string | null;
  image_url: string | null;
  is_main: boolean;
  created_at: string;
  /** join 결과 */
  vote_count?: number;
  vote_total?: number;
}

export interface VenturePrototypeTask {
  id: string;
  project_id: string;
  title: string;
  status: "todo" | "doing" | "done";
  assignee_id: string | null;
  due_date: string | null;
  sort_order: number;
  created_at: string;
}

export interface VentureFeedback {
  id: string;
  project_id: string;
  author_id: string | null;
  tester_name: string | null;
  score: number | null;
  note: string;
  created_at: string;
}

export interface VenturePlanContent {
  summary: string;
  problem: string;
  solution: string;
  target: string;
  market: string;
  business_model: string;
  milestones: string[];
  team: string;
}

export interface VenturePlan {
  id: string;
  project_id: string;
  version: number;
  is_current: boolean;
  generated_by: "ai" | "manual" | null;
  model: string | null;
  content: VenturePlanContent;
  created_by: string | null;
  created_at: string;
}

export interface StageProgress {
  stage: VentureStage;
  complete: boolean;
  count: number;
  label: string;
  blocker?: string;
}
