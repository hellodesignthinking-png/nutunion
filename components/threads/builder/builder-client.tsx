"use client";
/**
 * BuilderClient — Level 1 No-Code Thread Builder.
 *
 * 3-column layout: palette (blocks) | canvas (current spec) | settings (selected block).
 * Click a palette block → adds to canvas. Select canvas item → edit in settings panel.
 * Test mode renders inline via GenericThread (ephemeral). Save POSTs to /api/threads/builder/save.
 */
import { useReducer, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { FieldSpec, FieldType, ViewSpec, ViewKind, ActionSpec, ActionKind } from "@/components/threads/generic-thread";
import { GenericThread } from "@/components/threads/generic-thread";

const FIELD_TYPES: { type: FieldType; label: string; icon: string }[] = [
  { type: "text", label: "텍스트", icon: "📝" },
  { type: "longtext", label: "긴 글", icon: "📄" },
  { type: "number", label: "숫자", icon: "🔢" },
  { type: "currency", label: "금액", icon: "💰" },
  { type: "date", label: "날짜", icon: "📅" },
  { type: "datetime", label: "일시", icon: "⏰" },
  { type: "checkbox", label: "체크박스", icon: "☑️" },
  { type: "select", label: "선택", icon: "🔽" },
  { type: "multiselect", label: "다중선택", icon: "✅" },
  { type: "tags", label: "태그", icon: "🏷️" },
  { type: "person", label: "담당자", icon: "👤" },
  { type: "url", label: "링크", icon: "🔗" },
  { type: "location", label: "위치", icon: "📍" },
  { type: "file", label: "파일", icon: "📎" },
];
const VIEW_TYPES: { kind: ViewKind; label: string; icon: string }[] = [
  { kind: "list", label: "목록", icon: "≡" },
  { kind: "table", label: "테이블", icon: "▦" },
  { kind: "kanban", label: "칸반", icon: "▤" },
  { kind: "calendar", label: "캘린더", icon: "📅" },
  { kind: "chart", label: "차트", icon: "📈" },
  { kind: "gallery", label: "갤러리", icon: "▣" },
];
const ACTION_TYPES: { kind: ActionKind; label: string; icon: string }[] = [
  { kind: "add", label: "추가", icon: "+" },
  { kind: "edit", label: "편집", icon: "✎" },
  { kind: "delete", label: "삭제", icon: "×" },
  { kind: "export", label: "내보내기", icon: "↓" },
  { kind: "notify", label: "알림", icon: "🔔" },
];

const ICONS = ["📋", "📊", "✅", "📅", "💬", "📚", "🎯", "🌟", "🔧", "🎨", "💼", "🏆"];
const CATEGORIES = ["communication", "project", "finance", "space_ops", "platform_ops", "growth", "custom", "integration", "ai"];

interface BuilderState {
  name: string;
  description: string;
  icon: string;
  scope: ("nut" | "bolt")[];
  category: string;
  fields: FieldSpec[];
  views: ViewSpec[];
  actions: ActionSpec[];
  selected: { kind: "field" | "view" | "action"; index: number } | null;
  // For editing existing
  threadId?: string | null;
}

type Action =
  | { type: "addField"; field: FieldSpec }
  | { type: "updateField"; index: number; patch: Partial<FieldSpec> }
  | { type: "removeField"; index: number }
  | { type: "addView"; view: ViewSpec }
  | { type: "updateView"; index: number; patch: Partial<ViewSpec> }
  | { type: "removeView"; index: number }
  | { type: "addAction"; action: ActionSpec }
  | { type: "removeAction"; index: number }
  | { type: "setMeta"; patch: Partial<Pick<BuilderState, "name" | "description" | "icon" | "scope" | "category">> }
  | { type: "select"; sel: BuilderState["selected"] }
  | { type: "loadAll"; state: Partial<BuilderState> };

function reducer(s: BuilderState, a: Action): BuilderState {
  switch (a.type) {
    case "addField": return { ...s, fields: [...s.fields, a.field] };
    case "updateField": return { ...s, fields: s.fields.map((f, i) => i === a.index ? { ...f, ...a.patch } : f) };
    case "removeField": return { ...s, fields: s.fields.filter((_, i) => i !== a.index), selected: null };
    case "addView": return { ...s, views: [...s.views, a.view] };
    case "updateView": return { ...s, views: s.views.map((v, i) => i === a.index ? { ...v, ...a.patch } : v) };
    case "removeView": return { ...s, views: s.views.filter((_, i) => i !== a.index), selected: null };
    case "addAction": {
      if (s.actions.some((x) => x.kind === a.action.kind)) return s;
      return { ...s, actions: [...s.actions, a.action] };
    }
    case "removeAction": return { ...s, actions: s.actions.filter((_, i) => i !== a.index), selected: null };
    case "setMeta": return { ...s, ...a.patch };
    case "select": return { ...s, selected: a.sel };
    case "loadAll": return { ...s, ...a.state };
  }
}

const BTN = "border-[3px] border-nu-ink font-mono-nu text-[11px] uppercase tracking-widest font-bold px-3 py-2 shadow-[3px_3px_0_0_#0D0F14] disabled:opacity-50";

interface Props {
  userId: string;
  initial?: any;
  threadId?: string;  // for edit mode
}

export function BuilderClient({ userId, initial, threadId }: Props) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, {
    name: initial?.name || "",
    description: initial?.description || "",
    icon: initial?.icon || "📋",
    scope: initial?.scope || ["bolt"],
    category: initial?.category || "custom",
    fields: initial?.fields || [],
    views: initial?.views || [{ kind: "list" }],
    actions: initial?.actions || [{ kind: "add", label: "추가" }, { kind: "edit", label: "편집" }, { kind: "delete", label: "삭제" }],
    selected: null,
    threadId: threadId || null,
  });

  const [testMode, setTestMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const addField = (type: FieldType) => {
    const key = `field_${state.fields.length + 1}`;
    const label = FIELD_TYPES.find((f) => f.type === type)?.label || "필드";
    const field: FieldSpec = { key, type, label };
    if (type === "select" || type === "multiselect") field.options = ["옵션 1", "옵션 2"];
    dispatch({ type: "addField", field });
    dispatch({ type: "select", sel: { kind: "field", index: state.fields.length } });
  };

  const addView = (kind: ViewKind) => {
    if (state.views.some((v) => v.kind === kind)) return;
    dispatch({ type: "addView", view: { kind } });
  };

  const addAction = (kind: ActionKind) => {
    const label = ACTION_TYPES.find((a) => a.kind === kind)?.label || "액션";
    dispatch({ type: "addAction", action: { kind, label } });
  };

  const validate = (): string | null => {
    if (!state.name.trim()) return "Thread 이름을 입력하세요";
    if (state.fields.length === 0) return "최소 하나의 필드가 필요합니다";
    if (state.views.length === 0) return "최소 하나의 뷰가 필요합니다";
    return null;
  };

  const save = async (asDraft = false) => {
    const err = validate();
    if (err && !asDraft) { setSaveError(err); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const body = {
        thread_id: state.threadId || null,
        builder_mode: "no-code",
        name: state.name,
        description: state.description,
        icon: state.icon,
        scope: state.scope,
        category: state.category,
        fields: state.fields,
        views: state.views,
        actions: state.actions,
        is_draft: asDraft,
      };
      const res = await fetch("/api/threads/builder/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "save_failed");
      // success — go to store detail
      if (asDraft) {
        alert("초안으로 저장됐어요.");
      } else {
        alert(`Thread 가 만들어졌어요!${json.project_id ? "\n개발용 볼트도 함께 생성됐습니다." : ""}`);
        router.push(`/threads/${json.slug}`);
      }
    } catch (e: any) {
      setSaveError(e.message || "save_failed");
    } finally {
      setSaving(false);
    }
  };

  if (testMode) {
    return (
      <div className="min-h-screen bg-nu-cream/20 px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-head text-xl font-extrabold">🧪 테스트 모드</h2>
            <button onClick={() => setTestMode(false)} className={`${BTN} bg-white`}>← 빌더로</button>
          </div>
          <p className="text-xs font-mono text-nu-muted">데이터는 저장되지 않습니다. 입력해보고 의도대로 동작하는지 확인하세요.</p>
          <GenericThread
            spec={{ title: state.name || "Untitled", description: state.description, fields: state.fields, views: state.views, actions: state.actions }}
            ephemeral
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nu-cream/20">
      {/* Top bar */}
      <header className="border-b-[3px] border-nu-ink bg-white px-4 py-3 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{state.icon}</span>
            <input
              value={state.name}
              onChange={(e) => dispatch({ type: "setMeta", patch: { name: e.target.value } })}
              placeholder="Thread 이름"
              className="border-[2px] border-nu-ink px-2 py-1 font-head text-lg font-bold bg-white"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setTestMode(true)} className={`${BTN} bg-white`} disabled={state.fields.length === 0}>🧪 테스트</button>
            <button onClick={() => save(true)} className={`${BTN} bg-white`} disabled={saving}>초안 저장</button>
            <button onClick={() => save(false)} className={`${BTN} bg-nu-pink text-white`} disabled={saving}>{saving ? "저장 중..." : "저장 + 설치"}</button>
          </div>
        </div>
        {saveError && <div className="max-w-7xl mx-auto mt-2 text-xs text-red-700 font-mono">{saveError}</div>}
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-[220px_1fr_280px] gap-3 p-3">
        {/* Palette */}
        <aside className="border-[3px] border-nu-ink bg-white p-3 space-y-3 max-h-[calc(100vh-90px)] overflow-y-auto sticky top-20 self-start">
          <Section title="필드 (14)">
            <div className="grid grid-cols-2 gap-1">
              {FIELD_TYPES.map((f) => (
                <button key={f.type} onClick={() => addField(f.type)} className="border-[2px] border-nu-ink px-1.5 py-1 text-[11px] font-mono bg-white hover:bg-nu-cream text-left">
                  {f.icon} {f.label}
                </button>
              ))}
            </div>
          </Section>
          <Section title="뷰 (6)">
            <div className="grid grid-cols-2 gap-1">
              {VIEW_TYPES.map((v) => {
                const on = state.views.some((sv) => sv.kind === v.kind);
                return (
                  <button key={v.kind} onClick={() => addView(v.kind)} disabled={on} className={`border-[2px] border-nu-ink px-1.5 py-1 text-[11px] font-mono text-left ${on ? "bg-nu-ink/10 opacity-50" : "bg-white hover:bg-nu-cream"}`}>
                    {v.icon} {v.label}
                  </button>
                );
              })}
            </div>
          </Section>
          <Section title="액션 (5)">
            <div className="grid grid-cols-2 gap-1">
              {ACTION_TYPES.map((a) => {
                const on = state.actions.some((sa) => sa.kind === a.kind);
                return (
                  <button key={a.kind} onClick={() => addAction(a.kind)} disabled={on} className={`border-[2px] border-nu-ink px-1.5 py-1 text-[11px] font-mono text-left ${on ? "bg-nu-ink/10 opacity-50" : "bg-white hover:bg-nu-cream"}`}>
                    {a.icon} {a.label}
                  </button>
                );
              })}
            </div>
          </Section>
        </aside>

        {/* Canvas */}
        <main className="border-[3px] border-nu-ink bg-white p-4 min-h-[600px]">
          <div className="space-y-4">
            <div>
              <Label>설명</Label>
              <textarea
                value={state.description}
                onChange={(e) => dispatch({ type: "setMeta", patch: { description: e.target.value } })}
                placeholder="이 Thread 가 어떤 역할을 하는지 한 줄로"
                className="w-full border-[2px] border-nu-ink px-2 py-1.5 text-sm font-mono"
                rows={2}
              />
            </div>

            <div>
              <Label>필드 ({state.fields.length})</Label>
              {state.fields.length === 0 ? (
                <Empty>← 좌측에서 필드 블록을 클릭하세요</Empty>
              ) : (
                <ul className="space-y-1">
                  {state.fields.map((f, i) => (
                    <li key={i}>
                      <button
                        onClick={() => dispatch({ type: "select", sel: { kind: "field", index: i } })}
                        className={`w-full text-left border-[2px] px-2 py-1.5 text-sm font-mono flex items-center gap-2 ${state.selected?.kind === "field" && state.selected.index === i ? "border-nu-pink bg-nu-pink/10" : "border-nu-ink bg-white"}`}>
                        <span className="text-[11px] font-mono-nu uppercase tracking-widest font-bold text-nu-muted w-20 truncate">{f.type}</span>
                        <span className="flex-1 truncate">{f.label}</span>
                        {f.required && <span className="text-nu-pink text-xs">필수</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <Label>뷰 ({state.views.length})</Label>
              <div className="flex flex-wrap gap-1">
                {state.views.map((v, i) => (
                  <button key={i} onClick={() => dispatch({ type: "select", sel: { kind: "view", index: i } })}
                    className={`border-[2px] px-2 py-1 text-xs font-mono ${state.selected?.kind === "view" && state.selected.index === i ? "border-nu-pink bg-nu-pink/10" : "border-nu-ink bg-white"}`}>
                    {v.kind}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>액션 ({state.actions.length})</Label>
              <div className="flex flex-wrap gap-1">
                {state.actions.map((a, i) => (
                  <button key={i} onClick={() => dispatch({ type: "select", sel: { kind: "action", index: i } })}
                    className={`border-[2px] px-2 py-1 text-xs font-mono ${state.selected?.kind === "action" && state.selected.index === i ? "border-nu-pink bg-nu-pink/10" : "border-nu-ink bg-white"}`}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>

        {/* Settings */}
        <aside className="border-[3px] border-nu-ink bg-white p-3 max-h-[calc(100vh-90px)] overflow-y-auto sticky top-20 self-start">
          {!state.selected ? (
            <MetaPanel state={state} dispatch={dispatch} />
          ) : state.selected.kind === "field" ? (
            <FieldPanel state={state} dispatch={dispatch} />
          ) : state.selected.kind === "view" ? (
            <ViewPanel state={state} dispatch={dispatch} />
          ) : (
            <ActionPanel state={state} dispatch={dispatch} />
          )}
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono-nu text-[10px] uppercase tracking-widest font-bold text-nu-muted mb-1">{title}</div>
      {children}
    </div>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono-nu text-[10px] uppercase tracking-widest font-bold text-nu-ink mb-1">{children}</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="border-[2px] border-dashed border-nu-ink/30 p-4 text-center text-xs font-mono text-nu-muted">{children}</div>;
}

function MetaPanel({ state, dispatch }: { state: BuilderState; dispatch: React.Dispatch<Action> }) {
  return (
    <div className="space-y-3">
      <div className="font-mono-nu text-[11px] uppercase tracking-widest font-bold">Thread 메타</div>
      <div>
        <Label>아이콘</Label>
        <div className="flex flex-wrap gap-1">
          {ICONS.map((ic) => (
            <button key={ic} onClick={() => dispatch({ type: "setMeta", patch: { icon: ic } })}
              className={`border-[2px] w-8 h-8 text-base ${state.icon === ic ? "border-nu-pink bg-nu-pink/10" : "border-nu-ink bg-white"}`}>
              {ic}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>스코프 (어디에 설치 가능?)</Label>
        <div className="flex gap-2">
          {(["nut", "bolt"] as const).map((sc) => {
            const on = state.scope.includes(sc);
            return (
              <button key={sc} onClick={() => dispatch({ type: "setMeta", patch: { scope: on ? state.scope.filter((x) => x !== sc) : [...state.scope, sc] } })}
                className={`border-[2px] border-nu-ink px-3 py-1 text-xs font-mono ${on ? "bg-nu-pink text-white" : "bg-white"}`}>
                {sc === "nut" ? "🥜 너트" : "🔩 볼트"}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <Label>카테고리</Label>
        <select value={state.category} onChange={(e) => dispatch({ type: "setMeta", patch: { category: e.target.value } })}
          className="w-full border-[2px] border-nu-ink px-2 py-1 text-sm font-mono">
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="text-[11px] font-mono text-nu-muted leading-relaxed pt-3 border-t-[2px] border-nu-ink/20">
        💡 캔버스에서 필드/뷰/액션을 선택하면 여기에 세부 설정이 나타납니다.
      </div>
    </div>
  );
}

function FieldPanel({ state, dispatch }: { state: BuilderState; dispatch: React.Dispatch<Action> }) {
  const idx = state.selected!.index;
  const f = state.fields[idx];
  if (!f) return null;
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="font-mono-nu text-[11px] uppercase tracking-widest font-bold">필드 · {f.type}</div>
        <button onClick={() => dispatch({ type: "select", sel: null })} aria-label="설정 패널 닫기" className="text-xs text-nu-muted hover:text-nu-ink focus:outline-none focus:ring-2 focus:ring-nu-pink px-1">×</button>
      </div>
      <div>
        <Label>레이블</Label>
        <input value={f.label} onChange={(e) => dispatch({ type: "updateField", index: idx, patch: { label: e.target.value } })}
          className="w-full border-[2px] border-nu-ink px-2 py-1 text-sm font-mono" />
      </div>
      <div>
        <Label>키 (영문)</Label>
        <input value={f.key} onChange={(e) => dispatch({ type: "updateField", index: idx, patch: { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_") } })}
          className="w-full border-[2px] border-nu-ink px-2 py-1 text-sm font-mono" />
      </div>
      <label className="flex items-center gap-2 text-xs font-mono">
        <input type="checkbox" checked={!!f.required} onChange={(e) => dispatch({ type: "updateField", index: idx, patch: { required: e.target.checked } })} />
        필수 입력
      </label>
      {(f.type === "select" || f.type === "multiselect") && (
        <div>
          <Label>옵션 (한 줄에 하나)</Label>
          <textarea value={(f.options || []).join("\n")} onChange={(e) => dispatch({ type: "updateField", index: idx, patch: { options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) } })}
            className="w-full border-[2px] border-nu-ink px-2 py-1 text-xs font-mono" rows={4} />
        </div>
      )}
      <button onClick={() => dispatch({ type: "removeField", index: idx })} className={`${BTN} bg-white text-red-700 w-full`}>이 필드 삭제</button>
    </div>
  );
}

function ViewPanel({ state, dispatch }: { state: BuilderState; dispatch: React.Dispatch<Action> }) {
  const idx = state.selected!.index;
  const v = state.views[idx];
  if (!v) return null;
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="font-mono-nu text-[11px] uppercase tracking-widest font-bold">뷰 · {v.kind}</div>
        <button onClick={() => dispatch({ type: "select", sel: null })} aria-label="설정 패널 닫기" className="text-xs text-nu-muted hover:text-nu-ink focus:outline-none focus:ring-2 focus:ring-nu-pink px-1">×</button>
      </div>
      <div>
        <Label>주 필드 (제목으로 표시)</Label>
        <select value={v.primary_field || ""} onChange={(e) => dispatch({ type: "updateView", index: idx, patch: { primary_field: e.target.value || undefined } })}
          className="w-full border-[2px] border-nu-ink px-2 py-1 text-sm font-mono">
          <option value="">— 자동 —</option>
          {state.fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
      </div>
      {v.kind === "kanban" && (
        <div>
          <Label>그룹 기준 (select 필드 권장)</Label>
          <select value={v.group_by || ""} onChange={(e) => dispatch({ type: "updateView", index: idx, patch: { group_by: e.target.value || undefined } })}
            className="w-full border-[2px] border-nu-ink px-2 py-1 text-sm font-mono">
            <option value="">— 선택 —</option>
            {state.fields.filter((f) => f.type === "select" || f.type === "text").map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </div>
      )}
      <button onClick={() => dispatch({ type: "removeView", index: idx })} className={`${BTN} bg-white text-red-700 w-full`}>이 뷰 삭제</button>
    </div>
  );
}

function ActionPanel({ state, dispatch }: { state: BuilderState; dispatch: React.Dispatch<Action> }) {
  const idx = state.selected!.index;
  const a = state.actions[idx];
  if (!a) return null;
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="font-mono-nu text-[11px] uppercase tracking-widest font-bold">액션 · {a.kind}</div>
        <button onClick={() => dispatch({ type: "select", sel: null })} aria-label="설정 패널 닫기" className="text-xs text-nu-muted hover:text-nu-ink focus:outline-none focus:ring-2 focus:ring-nu-pink px-1">×</button>
      </div>
      <div className="text-xs font-mono text-nu-muted">{a.label}</div>
      <button onClick={() => dispatch({ type: "removeAction", index: idx })} className={`${BTN} bg-white text-red-700 w-full`}>이 액션 삭제</button>
    </div>
  );
}
