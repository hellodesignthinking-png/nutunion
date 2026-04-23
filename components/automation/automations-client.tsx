"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { AutomationTemplate } from "@/lib/automation/templates";

type Rule = {
  id: string;
  template_id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  is_active: boolean;
  require_approval: boolean;
  scope: { kind?: string; ids?: string[] } | null;
  run_count: number | null;
  last_run_at: string | null;
};

type Props = {
  templates: AutomationTemplate[];
  initialRules: Rule[];
  groups: { id: string; name: string }[];
  projects: { id: string; title: string }[];
  disabled?: boolean;
};

export function AutomationsClient({ templates, initialRules, groups, projects, disabled }: Props) {
  const [tab, setTab] = useState<"library" | "active">("library");
  const [rules, setRules] = useState<Rule[]>(initialRules);
  const [activeTemplate, setActiveTemplate] = useState<AutomationTemplate | null>(null);
  const [logs, setLogs] = useState<Record<string, any[]>>({});
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const router = useRouter();

  const grouped = useMemo(() => {
    const byCat: Record<string, AutomationTemplate[]> = {};
    for (const t of templates) {
      byCat[t.category] = byCat[t.category] || [];
      byCat[t.category].push(t);
    }
    return byCat;
  }, [templates]);

  async function handleToggle(rule: Rule) {
    const nextActive = !rule.is_active;
    setRules((rs) => rs.map((r) => (r.id === rule.id ? { ...r, is_active: nextActive } : r)));
    await fetch(`/api/automations/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: nextActive }),
    });
  }

  async function handleDelete(rule: Rule) {
    if (!confirm(`"${rule.name}" 룰을 삭제할까요?`)) return;
    await fetch(`/api/automations/${rule.id}`, { method: "DELETE" });
    setRules((rs) => rs.filter((r) => r.id !== rule.id));
  }

  async function handleShowLogs(rule: Rule) {
    if (expandedRule === rule.id) {
      setExpandedRule(null);
      return;
    }
    setExpandedRule(rule.id);
    if (!logs[rule.id]) {
      const r = await fetch(`/api/automations/${rule.id}/logs`);
      if (r.ok) {
        const d = await r.json();
        setLogs((prev) => ({ ...prev, [rule.id]: d.logs || [] }));
      }
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-5 border-b-[3px] border-nu-ink">
        <button
          onClick={() => setTab("library")}
          className={`px-4 py-2 font-bold border-[3px] border-b-0 border-nu-ink ${
            tab === "library" ? "bg-nu-pink text-white" : "bg-white text-nu-ink"
          }`}
        >
          라이브러리
        </button>
        <button
          onClick={() => setTab("active")}
          className={`px-4 py-2 font-bold border-[3px] border-b-0 border-nu-ink ${
            tab === "active" ? "bg-nu-pink text-white" : "bg-white text-nu-ink"
          }`}
        >
          내 자동화 ({rules.length})
        </button>
      </div>

      {tab === "library" && (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, list]) => (
            <section key={cat}>
              <h2 className="text-lg font-black text-nu-ink mb-2">{cat}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {list.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 border-[3px] border-nu-ink bg-white shadow-[3px_3px_0_#0D0D0D]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">{t.icon}</div>
                      <div className="flex-1">
                        <h3 className="font-bold text-nu-ink">{t.name}</h3>
                        <p className="text-sm text-nu-ink/70 mt-1">{t.description}</p>
                        {t.suggested_approval && (
                          <span className="inline-block mt-2 text-xs font-bold text-nu-pink">승인 권장</span>
                        )}
                      </div>
                    </div>
                    <button
                      disabled={disabled}
                      onClick={() => setActiveTemplate(t)}
                      className="mt-3 w-full px-3 py-2 border-[3px] border-nu-ink bg-nu-pink text-white font-bold disabled:opacity-50 shadow-[3px_3px_0_#0D0D0D] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition"
                    >
                      사용하기
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === "active" && (
        <div className="space-y-3">
          {rules.length === 0 && (
            <p className="text-nu-ink/60 text-sm">
              아직 활성화된 자동화가 없어요. 라이브러리에서 템플릿을 선택해 시작하세요.
            </p>
          )}
          {rules.map((rule) => (
            <div key={rule.id} className="border-[3px] border-nu-ink bg-white">
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="font-bold text-nu-ink">{rule.name}</p>
                  <p className="text-xs text-nu-ink/60 mt-1">
                    트리거 {rule.trigger_type} · 실행 {rule.run_count || 0}회
                    {rule.require_approval ? " · 승인필요" : ""}
                    {rule.last_run_at ? ` · 마지막 ${new Date(rule.last_run_at).toLocaleString("ko-KR")}` : ""}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={rule.is_active} onChange={() => handleToggle(rule)} />
                  활성
                </label>
                <button
                  onClick={() => handleShowLogs(rule)}
                  className="px-2 py-1 text-xs border-[2px] border-nu-ink bg-white font-bold"
                >
                  로그
                </button>
                <button
                  onClick={() => handleDelete(rule)}
                  className="px-2 py-1 text-xs border-[2px] border-nu-ink bg-white font-bold text-red-600"
                >
                  삭제
                </button>
              </div>
              {expandedRule === rule.id && (
                <div className="border-t-[3px] border-nu-ink bg-nu-paper p-3">
                  {(logs[rule.id] || []).length === 0 ? (
                    <p className="text-xs text-nu-ink/60">실행 로그가 아직 없어요.</p>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {(logs[rule.id] || []).slice(0, 20).map((l: any) => (
                        <li key={l.id} className="flex gap-2">
                          <span className="font-mono">{new Date(l.executed_at).toLocaleString("ko-KR")}</span>
                          <span className="font-bold">{l.status}</span>
                          {l.error && <span className="text-red-600">{l.error}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTemplate && (
        <SetupModal
          template={activeTemplate}
          groups={groups}
          projects={projects}
          onClose={() => setActiveTemplate(null)}
          onSaved={(newRule) => {
            setRules((rs) => [newRule, ...rs]);
            setActiveTemplate(null);
            setTab("active");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function SetupModal({
  template,
  groups,
  projects,
  onClose,
  onSaved,
}: {
  template: AutomationTemplate;
  groups: { id: string; name: string }[];
  projects: { id: string; title: string }[];
  onClose: () => void;
  onSaved: (rule: Rule) => void;
}) {
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [requireApproval, setRequireApproval] = useState<boolean>(!!template.suggested_approval);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 고급 조건 JSON 에디터
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [conditionsText, setConditionsText] = useState<string>("{}");
  const [conditionsValid, setConditionsValid] = useState<boolean>(true);

  // 외부 웹훅 템플릿용 상태
  const isWebhookTemplate = template.id === "external_notify";
  const defaultAct = template.default_actions?.[0]?.params || {};
  const [webhookService, setWebhookService] = useState<string>(defaultAct.service || "discord");
  const [webhookUrl, setWebhookUrl] = useState<string>(defaultAct.webhook_url || "");
  const [webhookMessage, setWebhookMessage] = useState<string>(
    defaultAct.message || "🔔 {title} 이벤트가 발생했어요.",
  );

  const needsGroup = template.scope_required === "group" || template.scope_required === "both";
  const needsProject = template.scope_required === "project" || template.scope_required === "both";
  const needsAny = needsGroup || needsProject;

  const conditionsHelp = useMemo(() => {
    switch (template.trigger_type) {
      case "chat.message_posted":
        return `{ "keyword_filter": "긴급", "exclude_keywords": ["테스트"] }`;
      case "meeting.completed":
        return `{ "min_participants": 3, "keyword_filter": "회고" }`;
      case "project.milestone_completed":
        return `{ "keyword_filter": "MVP" }`;
      case "group.member_joined":
        return `{}`;
      default:
        return `{ "keyword_filter": "키워드" }`;
    }
  }, [template.trigger_type]);

  function validateConditions(text: string) {
    if (!text.trim()) {
      setConditionsValid(true);
      return;
    }
    try {
      const parsed = JSON.parse(text);
      setConditionsValid(parsed && typeof parsed === "object" && !Array.isArray(parsed));
    } catch {
      setConditionsValid(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    let scope: any = { kind: "all", ids: [] };
    if (template.scope_required === "group") scope = { kind: "group", ids: selectedGroups };
    else if (template.scope_required === "project") scope = { kind: "project", ids: selectedProjects };
    else if (template.scope_required === "both")
      scope = { kind: "both", ids: [...selectedGroups, ...selectedProjects] };

    let conditions: any = {};
    if (conditionsText.trim()) {
      try {
        conditions = JSON.parse(conditionsText);
      } catch {
        setError("조건 JSON 이 올바르지 않아요.");
        setSaving(false);
        return;
      }
    }

    // Webhook template — override actions with user inputs
    let actions: any[] | undefined;
    if (isWebhookTemplate) {
      if (!webhookUrl.trim()) {
        setError("Webhook URL 을 입력해주세요.");
        setSaving(false);
        return;
      }
      actions = [
        {
          type: "webhook_notify",
          params: {
            service: webhookService,
            webhook_url: webhookUrl.trim(),
            message: webhookMessage,
          },
        },
      ];
    }

    const res = await fetch("/api/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template_id: template.id,
        scope,
        require_approval: requireApproval,
        conditions,
        actions,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "저장 실패");
      setSaving(false);
      return;
    }
    onSaved(data.rule);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white border-[3px] border-nu-ink shadow-[6px_6px_0_#0D0D0D] max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b-[3px] border-nu-ink flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{template.icon}</span>
            <h2 className="font-black text-nu-ink">{template.name}</h2>
          </div>
          <button onClick={onClose} className="font-bold text-xl">
            ×
          </button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-nu-ink/70">{template.description}</p>

          {needsGroup && (
            <div>
              <p className="font-bold text-sm mb-2">적용 너트</p>
              <div className="border-[2px] border-nu-ink p-2 max-h-40 overflow-y-auto space-y-1">
                {groups.length === 0 && <p className="text-xs text-nu-ink/60">가입한 너트가 없어요.</p>}
                {groups.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedGroups.includes(g.id)}
                      onChange={(e) =>
                        setSelectedGroups((prev) =>
                          e.target.checked ? [...prev, g.id] : prev.filter((x) => x !== g.id),
                        )
                      }
                    />
                    {g.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {needsProject && (
            <div>
              <p className="font-bold text-sm mb-2">적용 볼트</p>
              <div className="border-[2px] border-nu-ink p-2 max-h-40 overflow-y-auto space-y-1">
                {projects.length === 0 && <p className="text-xs text-nu-ink/60">참여 볼트가 없어요.</p>}
                {projects.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedProjects.includes(p.id)}
                      onChange={(e) =>
                        setSelectedProjects((prev) =>
                          e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id),
                        )
                      }
                    />
                    {p.title}
                  </label>
                ))}
              </div>
            </div>
          )}

          {!needsAny && (
            <p className="text-xs text-nu-ink/60">
              이 자동화는 전체 범위에 적용됩니다 (내가 소유한 항목 기준).
            </p>
          )}

          {isWebhookTemplate && (
            <div className="border-[3px] border-nu-ink p-3 space-y-2 bg-nu-paper">
              <p className="font-bold text-sm">외부 Webhook 설정</p>
              <div>
                <label className="text-xs font-bold block mb-1">서비스</label>
                <select
                  value={webhookService}
                  onChange={(e) => setWebhookService(e.target.value)}
                  className="w-full px-2 py-1 border-[2px] border-nu-ink bg-white text-sm"
                >
                  <option value="discord">Discord</option>
                  <option value="slack">Slack</option>
                  <option value="kakao">Kakao (placeholder)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Webhook URL</label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="w-full px-2 py-1 border-[2px] border-nu-ink bg-white text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">메시지 템플릿</label>
                <input
                  type="text"
                  value={webhookMessage}
                  onChange={(e) => setWebhookMessage(e.target.value)}
                  placeholder="🔔 {title} 이벤트"
                  className="w-full px-2 py-1 border-[2px] border-nu-ink bg-white text-sm"
                />
                <p className="text-[10px] text-nu-ink/50 mt-1">
                  {"{title}, {name}, {milestone_name} 등 payload 변수 사용 가능"}
                </p>
              </div>
            </div>
          )}

          <div className="border-t-[2px] border-nu-ink/20 pt-3">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-xs font-bold text-nu-ink/70 hover:text-nu-pink"
            >
              {showAdvanced ? "▼" : "▶"} 고급 조건 (conditions JSON)
            </button>
            {showAdvanced && (
              <div className="mt-2 space-y-1">
                <textarea
                  value={conditionsText}
                  onChange={(e) => {
                    setConditionsText(e.target.value);
                  }}
                  onBlur={(e) => validateConditions(e.target.value)}
                  placeholder={conditionsHelp}
                  rows={4}
                  className={`w-full px-2 py-1 border-[2px] bg-white text-xs font-mono ${
                    conditionsValid ? "border-nu-ink" : "border-red-600"
                  }`}
                />
                <p className="text-[10px] text-nu-ink/60">
                  예시: <code className="font-mono">{conditionsHelp}</code>
                </p>
                <p className="text-[10px] text-nu-ink/50">
                  지원 키: keyword_filter, exclude_keywords, min_participants, max_participants, sender_id
                </p>
                {!conditionsValid && (
                  <p className="text-[10px] text-red-600 font-bold">JSON 형식이 올바르지 않아요.</p>
                )}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={requireApproval}
              onChange={(e) => setRequireApproval(e.target.checked)}
            />
            실행 전 승인 필요 (HITL)
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-3 py-2 border-[3px] border-nu-ink bg-nu-pink text-white font-bold disabled:opacity-50 shadow-[3px_3px_0_#0D0D0D]"
            >
              {saving ? "저장 중…" : "활성화"}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 border-[3px] border-nu-ink bg-white font-bold"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
