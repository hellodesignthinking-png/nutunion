"use client";
import { useEffect, useState } from "react";
import { registry, type ThreadProps } from "@/lib/threads/registry";
import {
  listThreadData,
  createThreadData,
  deleteThreadData,
  type ThreadDataRow,
} from "@/lib/threads/data-client";

interface Announcement {
  title: string;
  body: string;
  severity: "info" | "important" | "urgent";
  pinned_until?: string | null;
}

const SEVERITY_STYLES: Record<string, string> = {
  info: "border-nu-ink/40 bg-blue-50 text-blue-900",
  important: "border-amber-500 bg-amber-50 text-amber-900",
  urgent: "border-red-500 bg-red-50 text-red-900",
};

function AnnouncementComponent({ installation, canEdit, currentUserId }: ThreadProps) {
  const [rows, setRows] = useState<ThreadDataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<Announcement["severity"]>("info");
  const [pinnedUntil, setPinnedUntil] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listThreadData(installation.id, { limit: 100 });
      setRows(data); setError(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [installation.id]);

  const now = Date.now();
  const isActive = (a: Announcement) => !a.pinned_until || new Date(a.pinned_until).getTime() > now;
  const sorted = [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const heroRow = sorted.find((r) => isActive(r.data as Announcement));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      await createThreadData(installation.id, {
        title: title.trim(),
        body: body.trim(),
        severity,
        pinned_until: pinnedUntil ? new Date(pinnedUntil).toISOString() : null,
      });
      setTitle(""); setBody(""); setSeverity("info"); setPinnedUntil(""); setShowForm(false);
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("삭제할까요?")) return;
    try { await deleteThreadData(id); await load(); } catch (e: any) { setError(e.message); }
  };

  const allowed = canEdit; // installation.config.allowedRoles checked server-side via membership

  return (
    <div className="border-[3px] border-nu-ink p-4 bg-white shadow-[4px_4px_0_0_#0D0F14] space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-head text-lg font-extrabold text-nu-ink">📢 공지</h3>
        <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">{rows.length}건</span>
      </div>

      {error && <div className="border-[2px] border-amber-500 bg-amber-50 p-2 text-[11px] font-mono">{error}</div>}

      {heroRow && (() => {
        const a = heroRow.data as Announcement;
        return (
          <div className={`border-[3px] p-4 ${SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.info}`}>
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="font-head text-xl font-extrabold">{a.title}</h4>
              <span className="font-mono-nu text-[10px] uppercase tracking-widest border-[1.5px] border-current px-1.5 py-0.5">
                {a.severity}
              </span>
            </div>
            <p className="text-sm mt-2 whitespace-pre-wrap">{a.body}</p>
            <div className="text-[10px] font-mono mt-2 opacity-70">
              {new Date(heroRow.created_at).toLocaleString("ko-KR")}
              {a.pinned_until && ` · ~${new Date(a.pinned_until).toLocaleDateString("ko-KR")}`}
            </div>
          </div>
        );
      })()}

      {allowed && (
        <div>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[11px] uppercase tracking-widest font-bold px-3 py-1 shadow-[2px_2px_0_0_#0D0F14] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#0D0F14] transition"
            >
              + 공지 작성
            </button>
          ) : (
            <form onSubmit={submit} className="space-y-2 border-[2px] border-nu-ink/30 p-3 bg-nu-cream/30">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목"
                className="w-full border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono" />
              <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="내용" rows={3}
                className="w-full border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono" />
              <div className="flex gap-2">
                <select value={severity} onChange={(e) => setSeverity(e.target.value as any)}
                  className="border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono">
                  <option value="info">info</option>
                  <option value="important">important</option>
                  <option value="urgent">urgent</option>
                </select>
                <input type="datetime-local" value={pinnedUntil} onChange={(e) => setPinnedUntil(e.target.value)}
                  className="border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono flex-1" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted px-2 py-1">
                  취소
                </button>
                <button disabled={submitting} className="border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[11px] uppercase tracking-widest font-bold px-3 py-1 shadow-[2px_2px_0_0_#0D0F14] disabled:opacity-50">
                  {submitting ? "..." : "발행"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-[11px] font-mono text-nu-muted">로딩...</div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((row) => {
            const a = row.data as Announcement;
            const active = isActive(a);
            return (
              <li key={row.id} className={`border-[2px] p-2 ${active ? "border-nu-ink" : "border-nu-ink/20 opacity-60"}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex-1">
                    <div className="text-sm font-bold text-nu-ink">{a.title}</div>
                    <div className="text-[11px] text-nu-muted font-mono">
                      {new Date(row.created_at).toLocaleString("ko-KR")} · {a.severity}
                      {!active && " · 만료"}
                    </div>
                  </div>
                  {row.created_by === currentUserId && (
                    <button onClick={() => remove(row.id)} className="text-[10px] font-mono text-nu-muted hover:text-nu-pink">삭제</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

registry.register({
  slug: "announcement",
  name: "📢 공지",
  description: "중요 공지를 상단 고정. 심각도/만료일 지원.",
  icon: "📢",
  category: "communication",
  scope: ["nut"],
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      body: { type: "string" },
      severity: { type: "string", enum: ["info", "important", "urgent"] },
      pinned_until: { type: ["string", "null"], format: "date-time" },
    },
    required: ["title", "body"],
  },
  configSchema: {
    type: "object",
    properties: { allowedRoles: { type: "array", items: { type: "string" }, default: ["host", "moderator"] } },
  },
  Component: AnnouncementComponent,
  isCore: true,
  version: "1.0.0",
});
