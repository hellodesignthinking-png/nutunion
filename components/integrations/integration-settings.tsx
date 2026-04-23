"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  TestTube,
  Webhook,
  MessageSquare,
  FileText,
  X,
  Zap,
  Power,
} from "lucide-react";
import type { Integration } from "@/lib/types";

interface IntegrationSettingsProps {
  workspaceType: "crew" | "project";
  workspaceId: string;
}

type IntegrationType = "slack" | "discord" | "notion" | "webhook";

interface IntegrationTypeOption {
  value: IntegrationType;
  label: string;
  icon: typeof Webhook;
  description: string;
  fields: { key: string; label: string; placeholder: string; required: boolean }[];
}

const integrationTypes: IntegrationTypeOption[] = [
  {
    value: "slack",
    label: "Slack",
    icon: MessageSquare,
    description: "Slack 채널에 알림을 보냅니다",
    fields: [
      {
        key: "webhook_url",
        label: "Webhook URL",
        placeholder: "https://hooks.slack.com/services/...",
        required: true,
      },
      {
        key: "channel",
        label: "채널",
        placeholder: "#general",
        required: false,
      },
    ],
  },
  {
    value: "discord",
    label: "Discord",
    icon: MessageSquare,
    description: "Discord 채널에 알림을 보냅니다",
    fields: [
      {
        key: "webhook_url",
        label: "Webhook URL",
        placeholder: "https://discord.com/api/webhooks/...",
        required: true,
      },
    ],
  },
  {
    value: "notion",
    label: "Notion",
    icon: FileText,
    description: "Notion 페이지와 연동합니다",
    fields: [
      {
        key: "page_url",
        label: "Page URL",
        placeholder: "https://www.notion.so/...",
        required: true,
      },
    ],
  },
  {
    value: "webhook",
    label: "Custom Webhook",
    icon: Webhook,
    description: "커스텀 웹훅 URL로 이벤트를 전달합니다",
    fields: [
      {
        key: "webhook_url",
        label: "Webhook URL",
        placeholder: "https://your-api.com/webhook",
        required: true,
      },
      {
        key: "events",
        label: "이벤트 (콤마 구분)",
        placeholder: "member_joined, task_completed, milestone_updated",
        required: false,
      },
    ],
  },
];

const typeIconMap: Record<IntegrationType, typeof Webhook> = {
  slack: MessageSquare,
  discord: MessageSquare,
  notion: FileText,
  webhook: Webhook,
};

export default function IntegrationSettings({
  workspaceType,
  workspaceId,
}: IntegrationSettingsProps) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<IntegrationType>("slack");
  const [formName, setFormName] = useState("");
  const [formConfig, setFormConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("integrations")
      .select("*")
      .eq("workspace_type", workspaceType)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("연동 목록을 불러올 수 없습니다");
      return;
    }

    setIntegrations(data ?? []);
    setLoading(false);
  }, [workspaceType, workspaceId]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  function resetForm() {
    setShowForm(false);
    setFormType("slack");
    setFormName("");
    setFormConfig({});
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();

    const typeOpt = integrationTypes.find((t) => t.value === formType);
    if (!typeOpt) return;

    // Validate required fields
    for (const field of typeOpt.fields) {
      if (field.required && !formConfig[field.key]?.trim()) {
        toast.error(`${field.label}을(를) 입력해주세요`);
        return;
      }
    }

    if (!formName.trim()) {
      toast.error("연동 이름을 입력해주세요");
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("로그인이 필요합니다");

      const { error } = await supabase.from("integrations").insert({
        workspace_type: workspaceType,
        workspace_id: workspaceId,
        type: formType,
        name: formName.trim(),
        config: formConfig,
        is_active: true,
        created_by: user.id,
      });

      if (error) throw error;

      toast.success("연동이 추가되었습니다");
      resetForm();
      fetchIntegrations();
    } catch (err: unknown) {
    const __err = err as { message?: string; code?: number; name?: string };
      toast.error(__err.message || "연동 추가 실패");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(integration: Integration) {
    setToggling(integration.id);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("integrations")
        .update({ is_active: !integration.is_active })
        .eq("id", integration.id);

      if (error) throw error;

      toast.success(
        integration.is_active ? "연동이 비활성화되었습니다" : "연동이 활성화되었습니다"
      );
      fetchIntegrations();
    } catch (err: unknown) {
    const __err = err as { message?: string; code?: number; name?: string };
      toast.error(__err.message || "상태 변경 실패");
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(integrationId: string) {
    if (!confirm("이 연동을 삭제하시겠습니까?")) return;

    setDeleting(integrationId);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("integrations")
        .delete()
        .eq("id", integrationId);

      if (error) throw error;

      toast.success("연동이 삭제되었습니다");
      fetchIntegrations();
    } catch (err: unknown) {
    const __err = err as { message?: string; code?: number; name?: string };
      toast.error(__err.message || "삭제 실패");
    } finally {
      setDeleting(null);
    }
  }

  async function handleTest(integration: Integration) {
    setTesting(integration.id);

    try {
      const webhookUrl =
        integration.config.webhook_url || integration.config.page_url;

      if (!webhookUrl) {
        toast.error("Webhook URL이 설정되지 않았습니다");
        return;
      }

      const testPayload = {
        event: "test",
        workspace_type: workspaceType,
        workspace_id: workspaceId,
        integration_name: integration.name,
        message: "NutUnion 연동 테스트 메시지입니다.",
        timestamp: new Date().toISOString(),
      };

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testPayload),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      // Log the test
      const supabase = createClient();
      await supabase.from("integration_logs").insert({
        integration_id: integration.id,
        event_type: "test",
        payload: testPayload,
        status: "success",
        response_code: res.status,
      });

      toast.success("테스트 메시지가 전송되었습니다");
    } catch (err: unknown) {
    const __err = err as { message?: string; code?: number; name?: string };
      // Log the failure
      const supabase = createClient();
      await supabase.from("integration_logs").insert({
        integration_id: integration.id,
        event_type: "test",
        payload: {},
        status: "error",
        error_message: __err.message,
      });

      toast.error("테스트 실패: " + __err.message);
    } finally {
      setTesting(null);
    }
  }

  const selectedType = integrationTypes.find((t) => t.value === formType);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={24} className="animate-spin text-nu-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-head text-lg font-bold text-nu-ink">
            외부 연동
          </h3>
          <p className="text-[13px] text-nu-muted mt-0.5">
            Slack, Discord, Notion 등과 연동하여 알림을 받을 수 있습니다
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 font-mono-nu text-[12px] font-bold uppercase tracking-[0.1em] px-4 py-2 bg-nu-ink text-nu-paper hover:bg-nu-ink/90 transition-colors"
          >
            <Plus size={12} />
            연동 추가
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="border border-nu-ink/[0.12] bg-nu-cream/20 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h4 className="font-head font-bold text-nu-ink text-sm">
              새 연동 추가
            </h4>
            <button
              onClick={resetForm}
              className="text-nu-muted hover:text-nu-ink transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleAdd} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-2">
                연동 이름 *
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="예: 프로젝트 알림 채널"
                className="w-full px-4 py-3 bg-nu-white border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink transition-colors"
                required
              />
            </div>

            {/* Type */}
            <div>
              <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-2">
                연동 유형 *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {integrationTypes.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => {
                        setFormType(t.value);
                        setFormConfig({});
                      }}
                      className={`flex flex-col items-center gap-1.5 p-3 border text-center transition-colors ${
                        formType === t.value
                          ? "border-nu-pink bg-nu-pink/5 text-nu-pink"
                          : "border-nu-ink/[0.12] text-nu-gray hover:border-nu-ink/30"
                      }`}
                    >
                      <Icon size={18} />
                      <span className="font-mono-nu text-[12px] uppercase tracking-widest">
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {selectedType && (
                <p className="mt-2 text-[13px] text-nu-muted">
                  {selectedType.description}
                </p>
              )}
            </div>

            {/* Dynamic fields */}
            {selectedType?.fields.map((field) => (
              <div key={field.key}>
                <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-2">
                  {field.label} {field.required && "*"}
                </label>
                <input
                  type="text"
                  value={formConfig[field.key] ?? ""}
                  onChange={(e) =>
                    setFormConfig((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                  placeholder={field.placeholder}
                  className="w-full px-4 py-3 bg-nu-white border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink transition-colors"
                  required={field.required}
                />
              </div>
            ))}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 font-mono-nu text-[12px] font-bold uppercase tracking-[0.1em] px-6 py-2.5 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Plus size={12} />
                )}
                추가
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="font-mono-nu text-[12px] font-bold uppercase tracking-[0.1em] px-6 py-2.5 border border-nu-ink/[0.12] text-nu-gray hover:text-nu-ink transition-colors"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Integration list */}
      {integrations.length === 0 && !showForm ? (
        <div className="text-center py-16 border border-dashed border-nu-ink/[0.12]">
          <Zap size={32} className="mx-auto text-nu-muted mb-3" />
          <p className="text-sm text-nu-gray">
            아직 연동이 없습니다
          </p>
          <p className="text-[13px] text-nu-muted mt-1">
            위의 &ldquo;연동 추가&rdquo; 버튼을 눌러 시작하세요
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {integrations.map((integration) => {
            const TypeIcon =
              typeIconMap[integration.type as IntegrationType] ?? Webhook;

            return (
              <div
                key={integration.id}
                className={`border p-5 flex items-start justify-between gap-4 transition-colors ${
                  integration.is_active
                    ? "border-nu-ink/[0.12] bg-nu-paper"
                    : "border-nu-ink/[0.06] bg-nu-cream/30 opacity-60"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 flex items-center justify-center shrink-0 ${
                      integration.is_active
                        ? "bg-nu-pink/10 text-nu-pink"
                        : "bg-nu-gray/10 text-nu-gray"
                    }`}
                  >
                    <TypeIcon size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-head font-bold text-nu-ink text-sm truncate">
                        {integration.name}
                      </p>
                      <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted bg-nu-cream px-1.5 py-0.5 shrink-0">
                        {integration.type}
                      </span>
                    </div>
                    {integration.config.webhook_url && (
                      <p className="text-[13px] text-nu-muted truncate mt-0.5">
                        {integration.config.webhook_url}
                      </p>
                    )}
                    {integration.config.channel && (
                      <p className="text-[13px] text-nu-muted mt-0.5">
                        채널: {integration.config.channel}
                      </p>
                    )}
                    {integration.config.events && (
                      <p className="text-[13px] text-nu-muted mt-0.5">
                        이벤트: {integration.config.events}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(integration)}
                    disabled={toggling === integration.id}
                    title={integration.is_active ? "비활성화" : "활성화"}
                    className={`p-2 transition-colors ${
                      integration.is_active
                        ? "text-green-600 hover:bg-green-50"
                        : "text-nu-muted hover:bg-nu-cream"
                    }`}
                  >
                    {toggling === integration.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Power size={14} />
                    )}
                  </button>

                  {/* Test */}
                  {integration.is_active &&
                    integration.type !== "notion" && (
                      <button
                        onClick={() => handleTest(integration)}
                        disabled={testing === integration.id}
                        title="테스트"
                        className="p-2 text-nu-blue hover:bg-nu-blue/5 transition-colors"
                      >
                        {testing === integration.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <TestTube size={14} />
                        )}
                      </button>
                    )}

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(integration.id)}
                    disabled={deleting === integration.id}
                    title="삭제"
                    className="p-2 text-nu-red hover:bg-nu-red/5 transition-colors"
                  >
                    {deleting === integration.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
