/**
 * Bolt 조회 레이어 — 서브타입을 type 에 맞춰 자동 조인.
 *
 * 서버(Supabase server client)에서만 사용. 클라이언트는 별도로 `fetchBoltClient` 추가 예정.
 *
 * 사용:
 *   const bolt = await getBolt(id);
 *   if (isAnchor(bolt)) { ... }
 */

import { createClient } from "@/lib/supabase/server";
import type {
  Bolt,
  BoltType,
  HexBolt,
  AnchorBolt,
  CarriageBolt,
  EyeBolt,
  WingBolt,
  AnchorFields,
  CarriageFields,
  EyeFields,
  WingFields,
  BoltMetricRow,
  MetricsPeriodType,
} from "./types";
import { asBoltType } from "./guards";

/**
 * 공통 projects 컬럼 — 기존 라우트가 의존하는 필드를 유지.
 * 서브타입 필드는 별도 테이블에서 가져옴.
 */
const BASE_PROJECT_COLS =
  "id, type, title, description, status, category, image_url, start_date, end_date, " +
  "created_by, created_at, updated_at, parent_bolt_id";

/**
 * 단일 볼트 조회 — 서브타입까지 자동 조인.
 * 존재하지 않거나 권한 없으면 null.
 */
export async function getBolt(id: string): Promise<Bolt | null> {
  const supabase = await createClient();

  const { data: baseData, error } = await supabase
    .from("projects")
    .select(BASE_PROJECT_COLS)
    .eq("id", id)
    .maybeSingle();

  if (error || !baseData) return null;
  // Supabase 는 select 문자열에서 type 추론이 느슨함 — any 로 내려서 우리가 타입 계약 담당.
  const base = baseData as any;

  const type = asBoltType(base.type);

  // 공통 필드만 있는 HexBolt 기본값
  const common = {
    id: base.id,
    title: base.title,
    description: base.description,
    status: base.status,
    category: base.category,
    image_url: base.image_url,
    created_by: base.created_by,
    created_at: base.created_at,
    updated_at: base.updated_at,
    parent_bolt_id: (base as any).parent_bolt_id ?? null,
  } as const;

  switch (type) {
    case "anchor": {
      const { data: sub } = await supabase
        .from("project_anchor")
        .select("*")
        .eq("project_id", id)
        .maybeSingle();
      const anchor: AnchorFields = {
        opened_at: sub?.opened_at ?? null,
        address: sub?.address ?? null,
        floor_area_sqm: sub?.floor_area_sqm ?? null,
        seat_count: sub?.seat_count ?? null,
        operating_hours: sub?.operating_hours ?? {},
        holidays: sub?.holidays ?? [],
        monthly_revenue_goal_krw: sub?.monthly_revenue_goal_krw ?? null,
        monthly_margin_goal_pct: sub?.monthly_margin_goal_pct ?? null,
      };
      return { ...common, type: "anchor", anchor } as AnchorBolt;
    }
    case "carriage": {
      const { data: sub } = await supabase
        .from("project_carriage")
        .select("*")
        .eq("project_id", id)
        .maybeSingle();
      const carriage: CarriageFields = {
        launched_at: sub?.launched_at ?? null,
        domain: sub?.domain ?? null,
        app_store_url: sub?.app_store_url ?? null,
        tech_stack: sub?.tech_stack ?? [],
        dau_goal: sub?.dau_goal ?? null,
        mau_goal: sub?.mau_goal ?? null,
        mrr_goal_krw: sub?.mrr_goal_krw ?? null,
        integrations: sub?.integrations ?? {},
      };
      return { ...common, type: "carriage", carriage } as CarriageBolt;
    }
    case "eye": {
      const { data: sub } = await supabase
        .from("project_eye")
        .select("*")
        .eq("project_id", id)
        .maybeSingle();
      const eye: EyeFields = {
        rollup_rule: sub?.rollup_rule ?? "sum",
        weights: sub?.weights ?? {},
      };
      return { ...common, type: "eye", eye } as EyeBolt;
    }
    case "wing": {
      const { data: sub } = await supabase
        .from("project_wing")
        .select("*")
        .eq("project_id", id)
        .maybeSingle();
      const wing: WingFields = {
        goal_metric: sub?.goal_metric ?? null,
        goal_value: sub?.goal_value ?? null,
        actual_value: sub?.actual_value ?? 0,
        budget_krw: sub?.budget_krw ?? null,
        channels: sub?.channels ?? [],
        start_date: base.start_date,
        end_date: base.end_date,
      };
      return { ...common, type: "wing", wing } as WingBolt;
    }
    case "hex":
    default: {
      return {
        ...common,
        type: "hex",
        start_date: base.start_date,
        end_date: base.end_date,
      } as HexBolt;
    }
  }
}

/**
 * 볼트 목록 조회 — 타입 필터 선택적.
 * 주의: 성능을 위해 서브타입 조인은 안 함 (각 카드에서 지연 로드).
 */
export async function listBolts(opts?: {
  type?: BoltType | BoltType[];
  parentId?: string | null;
  status?: string;
  limit?: number;
}): Promise<Array<Pick<Bolt, "id" | "type" | "title" | "status">>> {
  const supabase = await createClient();
  let q = supabase
    .from("projects")
    .select("id, type, title, status")
    .order("created_at", { ascending: false });

  if (opts?.type) {
    if (Array.isArray(opts.type)) q = q.in("type", opts.type);
    else q = q.eq("type", opts.type);
  }
  if (opts?.parentId !== undefined) {
    if (opts.parentId === null) q = q.is("parent_bolt_id", null);
    else q = q.eq("parent_bolt_id", opts.parentId);
  }
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.limit) q = q.limit(opts.limit);

  const { data } = await q;
  return (data || []).map((r: any) => ({
    id: r.id,
    type: asBoltType(r.type),
    title: r.title,
    status: r.status,
  }));
}

/**
 * Eye 볼트의 하위 볼트 조회.
 */
export async function getChildBolts(parentId: string) {
  return listBolts({ parentId });
}

/**
 * bolt_metrics 조회 — Anchor/Carriage/Wing 의 주기 지표.
 */
export async function getMetrics(
  projectId: string,
  opts?: { periodType?: MetricsPeriodType; since?: string; until?: string; limit?: number },
): Promise<BoltMetricRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("bolt_metrics")
    .select("*")
    .eq("project_id", projectId)
    .order("period_start", { ascending: false });

  if (opts?.periodType) q = q.eq("period_type", opts.periodType);
  if (opts?.since) q = q.gte("period_start", opts.since);
  if (opts?.until) q = q.lte("period_start", opts.until);
  if (opts?.limit) q = q.limit(opts.limit);

  const { data } = await q;
  return (data || []) as BoltMetricRow[];
}
