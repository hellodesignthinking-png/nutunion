"use client";

import { useReducer, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { TriggerSpec, ActionSpec } from "@/lib/automation/palette";
import { ActionParamsForm } from "./action-forms";

type BuilderState = {
  name: string;
  trigger_type: string | null;
  conditions: {
    keyword_filter?: string;
    exclude_keywords?: string[];
    min_participants?: number;
  };
  actions: { type: string; params: Record<string, any> }[];
  scope: { kind: "all" | "group" | "project" | "both"; ids: string[] };
  require_approval: boolean;
};

type Action =
  | { kind: "set_name"; value: string }
  | { kind: "set_trigger"; value: string }
  | { kind: "add_action"; value: { type: string; params: Record<string, any> } }
  | { kind: "remove_action"; index: number }
  | { kind: "update_action_params"; index: number; params: Record<string, any> }
  | { kind: "move_action"; from: number; to: number }
  | { kind: "set_conditions"; value: BuilderState["conditions"] }
  | { kind: "set_scope"; value: BuilderState["scope"] }
  | { kind: "set_require_approval"; value: boolean };

function reducer(state: BuilderState, a: Action): BuilderState {
  switch (a.kind) {
    case "set_name":
      return { ...state, name: a.value };
    case "set_trigger":
      return { ...state, trigger_type: a.value };
    case "add_action":
      if (state.actions.length >= 5) return state;
      return { ...state, actions: [...state.actions, a.value] };
    case "remove_action":
      return { ...state, actions: state.actions.filter((_, i) => i !== a.index) };
    case "update_action_params": {
      const next = state.actions.slice();
      next[a.index] = { ...next[a.index], params: a.params };
      return { ...state, actions: next };
    }
    case "move_action": {
      if (a.from === a.to) return state;
      const next = state.actions.slice();
      const [item] = next.splice(a.from, 1);
      next.splice(a.to, 0, item);
      return { ...state, actions: next };
    }
    case "set_conditions":
      return { ...state, conditions: a.value };
    case "set_scope":
      return { ...state, scope: a.value };
    case "set_require_approval":
      return { ...state, require_approval: a.value };
  }
}

const initial: BuilderState = {
  name: "",
  trigger_type: null,
  conditions: {},
  actions: [],
  scope: { kind: "all", ids: [] },
  require_approval: false,
};

type Props = {
  triggers: TriggerSpec[];
  actions: ActionSpec[];
  groups: { id: string; name: string }[];
  projects: { id: string; title: string }[];
  disabled?: boolean;
};

export function BuilderClient({ triggers, actions: actionSpecs, groups, projects, disabled }: Props) {
  const [state, dispatch] = useReducer(reducer, initial);
  const [selectedNode, setSelectedNode] = useState<
    { kind: "trigger" } | { kind: "condition" } | { kind: "action"; index: number } | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const router = useRouter();

  const trigger = useMemo(
    () => triggers.find((t) => t.id === state.trigger_type) || null,
    [triggers, state.trigger_type],
  );

  // Drag handlers
  function onPaletteDragStart(e: React.DragEvent, payload: { kind: "trigger" | "action"; id: string }) {
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copy";
  }
  function onCanvasDrop(e: React.DragEvent) {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      if (data.kind === "trigger") {
        dispatch({ kind: "set_trigger", value: data.id });
        setSelectedNode({ kind: "trigger" });
      } else if (data.kind === "action") {
        const spec = actionSpecs.find((s) => s.type === data.id);
        if (!spec) return;
        if (state.actions.length >= 5) {
          setErr("액션은 최대 5개까지 추가할 수 있어요.");
          return;
        }
        dispatch({
          kind: "add_action",
          value: { type: spec.type, params: { ...spec.default_params } },
        });
        setSelectedNode({ kind: "action", index: state.actions.length });
        setErr(null);
      }
    } catch {
      /* ignore */
    }
  }
  function onCanvasDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  // Action reorder via drag inside the action list
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Scope derived needs
  const needsScope = useMemo(() => {
    if (!trigger) return "all";
    if (trigger.id.startsWith("group.") || trigger.id === "resource.uploaded") return "group";
    if (trigger.id.startsWith("project.") || trigger.id === "meeting.completed") return "project";
    return "all";
  }, [trigger]);

  async function handleSave() {
    if (!state.trigger_type) {
      setErr("트리거를 먼저 선택해주세요.");
      return;
    }
    if (state.actions.length === 0) {
      setErr("액션을 최소 1개 추가해주세요.");
      return;
    }
    if (!state.name.trim()) {
      setErr("룰 이름을 입력해주세요.");
      return;
    }

    setSaving(true);
    setErr(null);

    // Custom rules reuse the template-based API. We piggyback on a synthetic
    // template_id="custom_builder" by crafting a minimal payload — but the
    // existing API requires a real template. Use a dedicated endpoint instead.
    const res = await fetch("/api/automations/custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: state.name.trim(),
        trigger_type: state.trigger_type,
        conditions: state.conditions,
        actions: state.actions,
        scope: state.scope,
        require_approval: state.require_approval,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "저장 실패");
      setSaving(false);
      return;
    }
    router.push("/settings/automations");
  }

  function handleTest() {
    // Build a mock payload based on trigger hints
    if (!trigger) {
      setTestResult("트리거가 없어요.");
      return;
    }
    const mock: Record<string, any> = {};
    for (const hint of trigger.payload_hints) {
      if (hint === "participant_count") mock[hint] = 4;
      else if (hint.endsWith("_id")) mock[hint] = "mock-" + hint;
      else mock[hint] = "예시 " + hint;
    }
    const lines: string[] = [
      `트리거: ${trigger.label}`,
      `조건: ${Object.keys(state.conditions).length === 0 ? "없음" : JSON.stringify(state.conditions)}`,
      `스코프: ${state.scope.kind}${state.scope.ids.length ? ` (${state.scope.ids.length}개)` : ""}`,
      `모의 payload: ${JSON.stringify(mock)}`,
      "실행될 액션:",
      ...state.actions.map(
        (a, i) => `  ${i + 1}. ${actionSpecs.find((s) => s.type === a.type)?.label || a.type} ${JSON.stringify(a.params)}`,
      ),
    ];
    if (state.require_approval) lines.push("※ 실제 실행 전 승인 필요 (HITL)");
    setTestResult(lines.join("\n"));
  }

  return (
    <>
      {err && (
        <div className="mb-3 p-3 border-[3px] border-red-600 bg-red-50 text-red-800 font-bold text-sm">
          {err}
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        {/* Left: Palette */}
        <aside className="col-span-12 md:col-span-3">
          <div className="border-[3px] border-nu-ink bg-white p-3 shadow-[3px_3px_0_#0D0D0D]">
            <h3 className="font-black text-nu-ink mb-2 text-sm">🎙️ 트리거</h3>
            <div className="space-y-2">
              {triggers.map((t) => (
                <div
                  key={t.id}
                  draggable={!disabled}
                  onDragStart={(e) => onPaletteDragStart(e, { kind: "trigger", id: t.id })}
                  className="p-2 border-[2px] border-nu-ink bg-nu-paper cursor-grab active:cursor-grabbing hover:bg-nu-pink/10"
                  title={t.description}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span>{t.icon}</span>
                    <span className="font-bold">{t.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 border-[3px] border-nu-ink bg-white p-3 shadow-[3px_3px_0_#0D0D0D]">
            <h3 className="font-black text-nu-ink mb-2 text-sm">⚡ 액션</h3>
            <div className="space-y-2">
              {actionSpecs.map((a) => (
                <div
                  key={a.type}
                  draggable={!disabled}
                  onDragStart={(e) => onPaletteDragStart(e, { kind: "action", id: a.type })}
                  className="p-2 border-[2px] border-nu-ink bg-nu-paper cursor-grab active:cursor-grabbing hover:bg-nu-pink/10"
                  title={a.description}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span>{a.icon}</span>
                    <span className="font-bold">{a.label}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-nu-ink/50 mt-2">드래그해서 캔버스에 놓기</p>
          </div>
        </aside>

        {/* Center: Canvas */}
        <section className="col-span-12 md:col-span-6">
          <div className="mb-3">
            <input
              type="text"
              value={state.name}
              onChange={(e) => dispatch({ kind: "set_name", value: e.target.value })}
              placeholder="룰 이름 (예: 긴급 회의 요약 → Slack)"
              className="w-full px-3 py-2 border-[3px] border-nu-ink bg-white font-bold text-nu-ink shadow-[3px_3px_0_#0D0D0D]"
            />
          </div>

          <div
            onDrop={onCanvasDrop}
            onDragOver={onCanvasDragOver}
            className="border-[3px] border-dashed border-nu-ink bg-white min-h-[500px] p-4 shadow-[3px_3px_0_#0D0D0D] relative"
          >
            {/* Trigger node */}
            <NodeBox
              title={trigger ? `${trigger.icon} ${trigger.label}` : "트리거를 여기에 놓으세요"}
              subtitle={trigger ? trigger.description : "좌측 팔레트에서 드래그"}
              selected={selectedNode?.kind === "trigger"}
              empty={!trigger}
              onClick={() => trigger && setSelectedNode({ kind: "trigger" })}
              tone="trigger"
            />

            <Connector />

            {/* Condition node */}
            <NodeBox
              title="🔎 조건"
              subtitle={
                Object.keys(state.conditions).length === 0
                  ? "조건 없음 (모든 이벤트)"
                  : JSON.stringify(state.conditions)
              }
              selected={selectedNode?.kind === "condition"}
              onClick={() => setSelectedNode({ kind: "condition" })}
              tone="condition"
            />

            <Connector />

            {/* Action nodes */}
            {state.actions.length === 0 ? (
              <div className="p-4 border-[2px] border-dashed border-nu-ink/40 text-center text-sm text-nu-ink/50">
                액션을 여기에 드롭 (최대 5개)
              </div>
            ) : (
              state.actions.map((act, i) => {
                const spec = actionSpecs.find((s) => s.type === act.type);
                return (
                  <div key={i}>
                    <div
                      draggable
                      onDragStart={() => setDragIndex(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragIndex !== null && dragIndex !== i) {
                          dispatch({ kind: "move_action", from: dragIndex, to: i });
                        }
                        setDragIndex(null);
                      }}
                    >
                      <NodeBox
                        title={`${spec?.icon || "⚡"} ${spec?.label || act.type}`}
                        subtitle={JSON.stringify(act.params).slice(0, 80)}
                        selected={selectedNode?.kind === "action" && selectedNode.index === i}
                        onClick={() => setSelectedNode({ kind: "action", index: i })}
                        onDelete={() => {
                          dispatch({ kind: "remove_action", index: i });
                          setSelectedNode(null);
                        }}
                        tone="action"
                      />
                    </div>
                    {i < state.actions.length - 1 && <Connector />}
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || disabled}
              className="flex-1 px-4 py-3 border-[3px] border-nu-ink bg-nu-pink text-white font-black shadow-[3px_3px_0_#0D0D0D] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition disabled:opacity-40"
            >
              {saving ? "저장 중…" : "💾 저장"}
            </button>
            <button
              onClick={handleTest}
              disabled={disabled}
              className="px-4 py-3 border-[3px] border-nu-ink bg-white font-black shadow-[3px_3px_0_#0D0D0D]"
            >
              🧪 테스트
            </button>
          </div>

          {testResult && (
            <pre className="mt-3 p-3 border-[3px] border-nu-ink bg-nu-paper text-xs whitespace-pre-wrap font-mono">
              {testResult}
            </pre>
          )}
        </section>

        {/* Right: Settings panel */}
        <aside className="col-span-12 md:col-span-3">
          <div className="border-[3px] border-nu-ink bg-white p-3 shadow-[3px_3px_0_#0D0D0D]">
            <h3 className="font-black text-nu-ink mb-3 text-sm">🛠️ 설정</h3>

            {!selectedNode && (
              <p className="text-xs text-nu-ink/60">캔버스에서 노드를 선택하세요.</p>
            )}

            {selectedNode?.kind === "trigger" && trigger && (
              <div>
                <p className="text-xs font-bold mb-1">{trigger.label}</p>
                <p className="text-[11px] text-nu-ink/60 mb-2">{trigger.description}</p>
                <p className="text-[10px] text-nu-ink/50">
                  사용 가능한 변수:{" "}
                  {trigger.payload_hints.length === 0
                    ? "(없음)"
                    : trigger.payload_hints.map((h) => `{${h}}`).join(", ")}
                </p>
              </div>
            )}

            {selectedNode?.kind === "condition" && (
              <div className="space-y-2">
                <label className="block text-xs font-bold">키워드 필터</label>
                <input
                  type="text"
                  value={state.conditions.keyword_filter || ""}
                  onChange={(e) =>
                    dispatch({
                      kind: "set_conditions",
                      value: { ...state.conditions, keyword_filter: e.target.value || undefined },
                    })
                  }
                  className="w-full px-2 py-1 border-[2px] border-nu-ink bg-white text-xs"
                  placeholder="포함되어야 할 키워드"
                />
                <label className="block text-xs font-bold">제외 키워드 (콤마 구분)</label>
                <input
                  type="text"
                  value={(state.conditions.exclude_keywords || []).join(",")}
                  onChange={(e) => {
                    const arr = e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    dispatch({
                      kind: "set_conditions",
                      value: { ...state.conditions, exclude_keywords: arr.length ? arr : undefined },
                    });
                  }}
                  className="w-full px-2 py-1 border-[2px] border-nu-ink bg-white text-xs"
                  placeholder="테스트,스팸"
                />
                <label className="block text-xs font-bold">최소 참가자 수</label>
                <input
                  type="number"
                  value={state.conditions.min_participants ?? ""}
                  onChange={(e) =>
                    dispatch({
                      kind: "set_conditions",
                      value: {
                        ...state.conditions,
                        min_participants: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                  className="w-full px-2 py-1 border-[2px] border-nu-ink bg-white text-xs"
                />

                <div className="pt-3 border-t-[2px] border-nu-ink/20">
                  <label className="block text-xs font-bold mb-1">스코프</label>
                  <select
                    value={state.scope.kind}
                    onChange={(e) =>
                      dispatch({
                        kind: "set_scope",
                        value: { kind: e.target.value as any, ids: [] },
                      })
                    }
                    className="w-full px-2 py-1 border-[2px] border-nu-ink bg-white text-xs"
                  >
                    <option value="all">전체 (내가 소유)</option>
                    <option value="group">특정 너트</option>
                    <option value="project">특정 볼트</option>
                    <option value="both">너트 + 볼트</option>
                  </select>

                  {(state.scope.kind === "group" || state.scope.kind === "both") && (
                    <div className="mt-2 max-h-28 overflow-y-auto border-[2px] border-nu-ink p-1">
                      {groups.length === 0 && (
                        <p className="text-[10px] text-nu-ink/50">너트 없음</p>
                      )}
                      {groups.map((g) => (
                        <label key={g.id} className="flex items-center gap-1 text-[11px]">
                          <input
                            type="checkbox"
                            checked={state.scope.ids.includes(g.id)}
                            onChange={(e) =>
                              dispatch({
                                kind: "set_scope",
                                value: {
                                  ...state.scope,
                                  ids: e.target.checked
                                    ? [...state.scope.ids, g.id]
                                    : state.scope.ids.filter((x) => x !== g.id),
                                },
                              })
                            }
                          />
                          {g.name}
                        </label>
                      ))}
                    </div>
                  )}

                  {(state.scope.kind === "project" || state.scope.kind === "both") && (
                    <div className="mt-2 max-h-28 overflow-y-auto border-[2px] border-nu-ink p-1">
                      {projects.length === 0 && (
                        <p className="text-[10px] text-nu-ink/50">볼트 없음</p>
                      )}
                      {projects.map((p) => (
                        <label key={p.id} className="flex items-center gap-1 text-[11px]">
                          <input
                            type="checkbox"
                            checked={state.scope.ids.includes(p.id)}
                            onChange={(e) =>
                              dispatch({
                                kind: "set_scope",
                                value: {
                                  ...state.scope,
                                  ids: e.target.checked
                                    ? [...state.scope.ids, p.id]
                                    : state.scope.ids.filter((x) => x !== p.id),
                                },
                              })
                            }
                          />
                          {p.title}
                        </label>
                      ))}
                    </div>
                  )}

                  {needsScope !== "all" && state.scope.kind === "all" && (
                    <p className="text-[10px] text-nu-ink/50 mt-2">
                      ℹ️ 이 트리거는 {needsScope} 범위에 해당해요. 전체로 두면 내가 속한 모든 항목에 적용됩니다.
                    </p>
                  )}
                </div>

                <label className="flex items-center gap-2 text-xs pt-2 border-t-[2px] border-nu-ink/20 mt-2">
                  <input
                    type="checkbox"
                    checked={state.require_approval}
                    onChange={(e) =>
                      dispatch({ kind: "set_require_approval", value: e.target.checked })
                    }
                  />
                  실행 전 승인 (HITL)
                </label>
              </div>
            )}

            {selectedNode?.kind === "action" && state.actions[selectedNode.index] && (
              <ActionParamsForm
                action={state.actions[selectedNode.index]}
                onChange={(params) =>
                  dispatch({
                    kind: "update_action_params",
                    index: selectedNode.index,
                    params,
                  })
                }
              />
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

function NodeBox({
  title,
  subtitle,
  selected,
  empty,
  onClick,
  onDelete,
  tone,
}: {
  title: string;
  subtitle?: string;
  selected?: boolean;
  empty?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
  tone: "trigger" | "condition" | "action";
}) {
  const bg =
    tone === "trigger" ? "bg-nu-pink/10" : tone === "condition" ? "bg-yellow-50" : "bg-nu-paper";
  return (
    <div
      onClick={onClick}
      className={`relative p-3 border-[3px] border-nu-ink ${bg} cursor-pointer ${
        selected ? "shadow-[3px_3px_0_#0D0D0D] translate-x-0 translate-y-0" : ""
      } ${empty ? "border-dashed opacity-60" : ""}`}
    >
      <div className="font-bold text-nu-ink text-sm">{title}</div>
      {subtitle && (
        <div className="text-[11px] text-nu-ink/60 mt-1 truncate font-mono">{subtitle}</div>
      )}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-1 right-1 w-5 h-5 border-[2px] border-nu-ink bg-white text-xs font-bold hover:bg-red-100"
          title="삭제"
        >
          ×
        </button>
      )}
    </div>
  );
}

function Connector() {
  return (
    <div className="flex justify-center my-1" aria-hidden>
      <svg width="20" height="24" viewBox="0 0 20 24">
        <line x1="10" y1="0" x2="10" y2="18" stroke="#0D0D0D" strokeWidth="3" />
        <polygon points="10,24 4,16 16,16" fill="#0D0D0D" />
      </svg>
    </div>
  );
}
