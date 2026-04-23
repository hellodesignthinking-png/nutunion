"use client";

/**
 * BoltTypeFields — 선택된 type 에 따라 유형별 전용 입력 필드 렌더.
 * 부모 폼이 상태를 관리. payload 는 onChange 로 평평한 객체로 전달.
 */

import type { BoltType } from "@/lib/bolt/types";

export type AnchorFieldsPayload = {
  opened_at?: string;
  address?: string;
  monthly_revenue_goal_krw?: number;
  monthly_margin_goal_pct?: number;
};
export type CarriageFieldsPayload = {
  launched_at?: string;
  domain?: string;
  dau_goal?: number;
  mau_goal?: number;
};
export type EyeFieldsPayload = {
  rollup_rule?: "sum" | "avg" | "weighted";
};
export type WingFieldsPayload = {
  goal_metric?: string;
  goal_value?: number;
  budget_krw?: number;
};
export type TorqueFieldsPayload = {
  engagement_type?: "one_time" | "retainer" | "hybrid";
  started_at?: string;
  ended_at?: string;
  scope_summary?: string;
  retainer_monthly_hours?: number;
  retainer_hourly_rate_krw?: number;
};

export type TypeFieldsPayload =
  | AnchorFieldsPayload
  | CarriageFieldsPayload
  | EyeFieldsPayload
  | WingFieldsPayload
  | TorqueFieldsPayload
  | Record<string, unknown>;

interface Props {
  type: BoltType;
  value: TypeFieldsPayload;
  onChange: (v: TypeFieldsPayload) => void;
}

const labelCls = "block text-[11px] font-mono-nu uppercase tracking-widest text-nu-graphite font-bold mb-1";
const inputCls = "w-full px-3 py-2 border-[1.5px] border-[color:var(--neutral-200)] rounded-[var(--ds-radius-md)] focus:border-[color:var(--liquid-primary)] outline-none text-[13px]";

export function BoltTypeFields({ type, value, onChange }: Props) {
  if (type === "hex") {
    return (
      <div className="p-3 bg-nu-cream/30 rounded text-[12px] text-nu-graphite">
        탐사형(Hex) — 추가 필드 없음. 시작일/종료일/마일스톤은 생성 후 설정합니다.
      </div>
    );
  }

  if (type === "anchor") {
    const v = value as AnchorFieldsPayload;
    return (
      <div className="space-y-3 p-4 border-[1.5px] border-nu-amber/30 bg-nu-amber/5 rounded-[var(--ds-radius-lg)]">
        <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-amber font-bold">
          🏢 Anchor Bolt · 공간형 필드
        </div>
        <div>
          <label className={labelCls}>오픈일</label>
          <input
            type="date"
            value={v.opened_at || ""}
            onChange={(e) => onChange({ ...v, opened_at: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>주소</label>
          <input
            type="text"
            value={v.address || ""}
            onChange={(e) => onChange({ ...v, address: e.target.value })}
            placeholder="서울특별시 ..."
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>월매출 목표 (원)</label>
            <input
              type="number"
              inputMode="numeric"
              value={v.monthly_revenue_goal_krw ?? ""}
              onChange={(e) =>
                onChange({ ...v, monthly_revenue_goal_krw: Number(e.target.value) || undefined })
              }
              placeholder="15000000"
              className={inputCls + " tabular-nums"}
            />
          </div>
          <div>
            <label className={labelCls}>마진 목표 (%)</label>
            <input
              type="number"
              step="0.1"
              value={v.monthly_margin_goal_pct ?? ""}
              onChange={(e) =>
                onChange({ ...v, monthly_margin_goal_pct: Number(e.target.value) || undefined })
              }
              placeholder="20"
              className={inputCls + " tabular-nums"}
            />
          </div>
        </div>
      </div>
    );
  }

  if (type === "carriage") {
    const v = value as CarriageFieldsPayload;
    return (
      <div className="space-y-3 p-4 border-[1.5px] border-nu-blue/30 bg-nu-blue/5 rounded-[var(--ds-radius-lg)]">
        <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-blue font-bold">
          🌐 Carriage Bolt · 플랫폼형 필드
        </div>
        <div>
          <label className={labelCls}>런칭일</label>
          <input
            type="date"
            value={v.launched_at || ""}
            onChange={(e) => onChange({ ...v, launched_at: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>도메인 / 앱스토어</label>
          <input
            type="url"
            value={v.domain || ""}
            onChange={(e) => onChange({ ...v, domain: e.target.value })}
            placeholder="example.com"
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>DAU 목표</label>
            <input
              type="number"
              inputMode="numeric"
              value={v.dau_goal ?? ""}
              onChange={(e) => onChange({ ...v, dau_goal: Number(e.target.value) || undefined })}
              placeholder="100"
              className={inputCls + " tabular-nums"}
            />
          </div>
          <div>
            <label className={labelCls}>MAU 목표</label>
            <input
              type="number"
              inputMode="numeric"
              value={v.mau_goal ?? ""}
              onChange={(e) => onChange({ ...v, mau_goal: Number(e.target.value) || undefined })}
              placeholder="500"
              className={inputCls + " tabular-nums"}
            />
          </div>
        </div>
      </div>
    );
  }

  if (type === "eye") {
    const v = value as EyeFieldsPayload;
    return (
      <div className="space-y-3 p-4 border-[1.5px] border-purple-300 bg-purple-50 rounded-[var(--ds-radius-lg)]">
        <div className="font-mono-nu text-[10px] uppercase tracking-widest text-purple-600 font-bold">
          🔗 Eye Bolt · 포트폴리오형 필드
        </div>
        <p className="text-[12px] text-purple-800 leading-[1.6]">
          Eye 볼트는 여러 하위 볼트를 묶는 컨테이너입니다. 생성 후 다른 볼트를 자식으로 연결하세요.
        </p>
        <div>
          <label className={labelCls}>롤업 규칙</label>
          <select
            value={v.rollup_rule || "sum"}
            onChange={(e) => onChange({ ...v, rollup_rule: e.target.value as EyeFieldsPayload["rollup_rule"] })}
            className={inputCls}
          >
            <option value="sum">합계 (Sum) — 총매출/총이익 단순 더하기</option>
            <option value="avg">평균 (Avg) — 마진/DAU 평균</option>
            <option value="weighted">가중평균 (Weighted) — 볼트별 가중치</option>
          </select>
        </div>
      </div>
    );
  }

  if (type === "wing") {
    const v = value as WingFieldsPayload;
    return (
      <div className="space-y-3 p-4 border-[1.5px] border-green-300 bg-green-50 rounded-[var(--ds-radius-lg)]">
        <div className="font-mono-nu text-[10px] uppercase tracking-widest text-green-700 font-bold">
          📢 Wing Bolt · 캠페인형 필드
        </div>
        <div>
          <label className={labelCls}>목표 지표</label>
          <input
            type="text"
            value={v.goal_metric || ""}
            onChange={(e) => onChange({ ...v, goal_metric: e.target.value })}
            placeholder="참석자, 매출, 가입자, ..."
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>목표 수치</label>
            <input
              type="number"
              inputMode="numeric"
              value={v.goal_value ?? ""}
              onChange={(e) => onChange({ ...v, goal_value: Number(e.target.value) || undefined })}
              placeholder="120"
              className={inputCls + " tabular-nums"}
            />
          </div>
          <div>
            <label className={labelCls}>예산 (원)</label>
            <input
              type="number"
              inputMode="numeric"
              value={v.budget_krw ?? ""}
              onChange={(e) => onChange({ ...v, budget_krw: Number(e.target.value) || undefined })}
              placeholder="500000"
              className={inputCls + " tabular-nums"}
            />
          </div>
        </div>
        <p className="text-[11px] text-green-800">
          Wing 볼트는 시작일·종료일을 위에서 입력한 값으로 사용합니다 (1~4주 권장).
        </p>
      </div>
    );
  }

  if (type === "torque") {
    const v = value as TorqueFieldsPayload;
    const isRetainer = v.engagement_type === "retainer" || v.engagement_type === "hybrid";
    return (
      <div className="space-y-3 p-4 border-[1.5px] border-teal-300 bg-teal-50 rounded-[var(--ds-radius-lg)]">
        <div className="font-mono-nu text-[10px] uppercase tracking-widest text-teal-700 font-bold">
          🎓 Torque Bolt · 컨설팅형 필드
        </div>

        <div>
          <label className={labelCls}>컨설팅 유형</label>
          <select
            value={v.engagement_type || "one_time"}
            onChange={(e) => onChange({ ...v, engagement_type: e.target.value as TorqueFieldsPayload["engagement_type"] })}
            className={inputCls}
          >
            <option value="one_time">일회성 (One-time) — 명확한 종료일</option>
            <option value="retainer">리테이너 (Retainer) — 월 계약 지속</option>
            <option value="hybrid">하이브리드 (Hybrid) — 혼합</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>컨설팅 시작일 *</label>
            <input
              type="date"
              value={v.started_at || ""}
              onChange={(e) => onChange({ ...v, started_at: e.target.value })}
              className={inputCls}
              required
            />
          </div>
          {v.engagement_type !== "retainer" && (
            <div>
              <label className={labelCls}>종료일 (리테이너는 생략)</label>
              <input
                type="date"
                value={v.ended_at || ""}
                onChange={(e) => onChange({ ...v, ended_at: e.target.value || undefined })}
                className={inputCls}
              />
            </div>
          )}
        </div>

        {isRetainer && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>월 계약 시간 (h)</label>
              <input
                type="number"
                inputMode="numeric"
                value={v.retainer_monthly_hours ?? ""}
                onChange={(e) => onChange({ ...v, retainer_monthly_hours: Number(e.target.value) || undefined })}
                placeholder="40"
                className={inputCls + " tabular-nums"}
              />
            </div>
            <div>
              <label className={labelCls}>시간당 단가 (원)</label>
              <input
                type="number"
                inputMode="numeric"
                value={v.retainer_hourly_rate_krw ?? ""}
                onChange={(e) => onChange({ ...v, retainer_hourly_rate_krw: Number(e.target.value) || undefined })}
                placeholder="150000"
                className={inputCls + " tabular-nums"}
              />
            </div>
          </div>
        )}

        <div>
          <label className={labelCls}>스코프 요약 (한 문장)</label>
          <input
            type="text"
            value={v.scope_summary || ""}
            onChange={(e) => onChange({ ...v, scope_summary: e.target.value })}
            placeholder="예: 3지점 확장을 위한 브랜드 아이덴티티 재정립"
            className={inputCls}
          />
        </div>

        <p className="text-[11px] text-teal-800 leading-relaxed">
          💡 컨설턴트 초대 및 내부 팀 구성은 볼트 생성 후 멤버 관리에서 설정합니다.
        </p>
      </div>
    );
  }

  return null;
}
