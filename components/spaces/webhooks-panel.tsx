"use client";

import { useEffect, useState } from "react";
import { X, Plus, Trash2, Loader2, Webhook, Send } from "lucide-react";
import { toast } from "sonner";

interface WebhookRow {
  id: string;
  name: string;
  url: string;
  preset: "slack" | "discord" | "generic";
  events: string[];
  enabled: boolean;
  last_called_at: string | null;
  last_status: number | null;
  last_error: string | null;
}

interface Props {
  open: boolean;
  ownerType: "nut" | "bolt";
  ownerId: string;
  onClose: () => void;
}

const ALL_EVENTS: Array<{ key: string; label: string }> = [
  { key: "page.created",   label: "페이지 생성" },
  { key: "page.updated",   label: "페이지 수정" },
  { key: "page.deleted",   label: "페이지 삭제" },
  { key: "page.shared",    label: "외부 공유 활성" },
  { key: "page.unshared",  label: "외부 공유 해제" },
  { key: "block.created",  label: "블록 추가" },
  { key: "block.updated",  label: "블록 편집" },
  { key: "block.deleted",  label: "블록 삭제" },
  { key: "comment.added",  label: "댓글 추가" },
  { key: "mention.created",label: "멘션" },
];

export function WebhooksPanel({ open, ownerType, ownerId, onClose }: Props) {
  const [hooks, setHooks] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  // form
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [preset, setPreset] = useState<"slack" | "discord" | "generic">("generic");
  const [events, setEvents] = useState<string[]>(["page.shared", "page.created"]);
  const [secret, setSecret] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/spaces/${ownerType}/${ownerId}/webhooks`)
      .then((r) => r.json())
      .then((j: { webhooks: WebhookRow[] }) => setHooks(j.webhooks ?? []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [open, ownerType, ownerId]);

  async function create() {
    if (!url.trim().startsWith("https://")) {
      toast.error("https URL 만 가능");
      return;
    }
    if (events.length === 0) {
      toast.error("이벤트 1개 이상 선택");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`/api/spaces/${ownerType}/${ownerId}/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), url: url.trim(), preset, events, secret: secret.trim() || undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "생성 실패");
      setHooks((prev) => [j.webhook, ...prev]);
      setName(""); setUrl(""); setSecret("");
      toast.success("웹훅 생성");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "실패");
    } finally {
      setCreating(false);
    }
  }

  async function toggle(h: WebhookRow) {
    setHooks((prev) => prev.map((x) => x.id === h.id ? { ...x, enabled: !x.enabled } : x));
    await fetch(`/api/spaces/webhooks/${h.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !h.enabled }),
    }).catch(() => undefined);
  }

  async function remove(id: string) {
    if (!window.confirm("이 웹훅을 삭제할까요?")) return;
    setHooks((prev) => prev.filter((x) => x.id !== id));
    await fetch(`/api/spaces/webhooks/${id}`, { method: "DELETE" }).catch(() => undefined);
  }

  async function testHook(id: string) {
    try {
      const res = await fetch(`/api/spaces/webhooks/${id}`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("테스트 발송 — 5초 후 결과 새로고침");
      // 5초 후 목록 다시 로드 (last_status 갱신)
      setTimeout(async () => {
        const r = await fetch(`/api/spaces/${ownerType}/${ownerId}/webhooks`);
        const j = await r.json();
        setHooks(j.webhooks ?? []);
      }, 5000);
    } catch {
      toast.error("테스트 실패");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-nu-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-nu-paper border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] max-w-xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b-[3px] border-nu-ink bg-white flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink">
            <Webhook size={11} /> 외부 통합 / Webhooks
          </div>
          <button onClick={onClose} className="p-1 text-nu-muted hover:text-nu-ink"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-4">
          {/* 발급 폼 */}
          <section className="bg-white border-[2px] border-nu-ink/15 p-3 space-y-2">
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">새 웹훅</div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름 — 예: '마케팅 슬랙'"
              maxLength={60}
              className="w-full px-2 py-1 text-[12px] border-[2px] border-nu-ink/20 focus:border-nu-ink outline-none"
            />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.slack.com/... 또는 discord webhook 또는 자체 URL"
              className="w-full px-2 py-1 text-[12px] border-[2px] border-nu-ink/20 focus:border-nu-ink outline-none"
            />
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-0.5">프리셋</div>
                <div className="flex gap-1">
                  {(["slack", "discord", "generic"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPreset(p)}
                      className={`font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border-[2px] ${preset === p ? "bg-nu-ink text-nu-paper border-nu-ink" : "border-nu-ink/30 hover:bg-nu-cream"}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              {preset === "generic" && (
                <div className="flex-1">
                  <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-0.5">HMAC secret (선택)</div>
                  <input
                    type="password"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder="X-Nutunion-Signature 검증용"
                    className="w-full px-2 py-1 text-[11px] border border-nu-ink/30 outline-none"
                  />
                </div>
              )}
            </div>
            <div>
              <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1">이벤트</div>
              <div className="flex flex-wrap gap-1">
                {ALL_EVENTS.map((e) => {
                  const checked = events.includes(e.key);
                  return (
                    <button
                      key={e.key}
                      type="button"
                      onClick={() => setEvents((p) => p.includes(e.key) ? p.filter((x) => x !== e.key) : [...p, e.key])}
                      className={`font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 border-[2px] ${checked ? "bg-nu-ink text-nu-paper border-nu-ink" : "border-nu-ink/30 hover:bg-nu-cream"}`}
                    >
                      {e.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={create}
              disabled={creating || !url.trim()}
              className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink bg-nu-ink text-nu-paper disabled:opacity-30 flex items-center gap-1"
            >
              {creating ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
              생성
            </button>
          </section>

          {/* 목록 */}
          <section>
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">
              내 웹훅 · {hooks.length}
            </div>
            {loading ? (
              <div className="flex items-center gap-1.5 text-[12px] text-nu-muted">
                <Loader2 size={11} className="animate-spin" /> 로드 중…
              </div>
            ) : hooks.length === 0 ? (
              <div className="text-[12px] text-nu-muted italic">등록된 웹훅 없음</div>
            ) : (
              <ul className="space-y-1.5">
                {hooks.map((h) => (
                  <li key={h.id} className={`bg-white border-[2px] ${h.enabled ? "border-nu-ink/20" : "border-nu-ink/10 opacity-60"} px-3 py-2`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-bold text-nu-ink">{h.name}</span>
                          <span className="font-mono-nu text-[9px] uppercase tracking-widest bg-nu-cream px-1 border border-nu-ink/15">
                            {h.preset}
                          </span>
                          {h.last_status && h.last_status >= 200 && h.last_status < 300 && (
                            <span className="font-mono-nu text-[9px] text-emerald-700">● {h.last_status}</span>
                          )}
                          {h.last_status && h.last_status >= 400 && (
                            <span className="font-mono-nu text-[9px] text-red-700">● {h.last_status}</span>
                          )}
                        </div>
                        <div className="font-mono-nu text-[10px] text-nu-muted truncate">{h.url}</div>
                        <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mt-0.5">
                          {h.events.length}개 이벤트
                          {h.last_called_at && ` · 마지막 ${new Date(h.last_called_at).toLocaleString("ko")}`}
                        </div>
                        {h.last_error && (
                          <div className="text-[10px] text-red-700 mt-0.5 break-all">⚠ {h.last_error.slice(0, 100)}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => testHook(h.id)}
                          title="테스트 발송"
                          className="p-1 text-nu-muted hover:text-nu-pink"
                        >
                          <Send size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggle(h)}
                          title={h.enabled ? "비활성화" : "활성화"}
                          className={`font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 border-[2px] ${h.enabled ? "border-emerald-700 text-emerald-700" : "border-nu-muted text-nu-muted"}`}
                        >
                          {h.enabled ? "ON" : "OFF"}
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(h.id)}
                          className="p-1 text-nu-muted hover:text-red-600"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
