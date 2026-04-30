"use client";
import { useEffect, useMemo, useState } from "react";
import { registry, type ThreadProps } from "@/lib/threads/registry";
import {
  listThreadData,
  createThreadData,
  updateThreadData,
  deleteThreadData,
  type ThreadDataRow,
} from "@/lib/threads/data-client";

interface CalendarEvent {
  title: string;
  description?: string;
  start_at: string;
  end_at?: string;
  location?: string;
  is_recurring?: boolean;
  recurrence_rule?: string;
}

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString("ko-KR", {
      month: "short", day: "numeric", weekday: "short",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return dt; }
}

function toICSDate(iso: string) {
  // Convert ISO → YYYYMMDDTHHMMSSZ
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function buildICS(events: { row: ThreadDataRow; e: CalendarEvent }[]) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//nutunion//Thread Calendar//KO",
    "CALSCALE:GREGORIAN",
  ];
  for (const { row, e } of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${row.id}@nutunion`);
    lines.push(`DTSTAMP:${toICSDate(row.created_at)}`);
    lines.push(`DTSTART:${toICSDate(e.start_at)}`);
    if (e.end_at) lines.push(`DTEND:${toICSDate(e.end_at)}`);
    lines.push(`SUMMARY:${(e.title || "").replace(/\n/g, " ")}`);
    if (e.description) lines.push(`DESCRIPTION:${e.description.replace(/\n/g, "\\n")}`);
    if (e.location) lines.push(`LOCATION:${e.location}`);
    if (e.is_recurring && e.recurrence_rule) lines.push(`RRULE:${e.recurrence_rule}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function CalendarComponent({ installation, canEdit, currentUserId }: ThreadProps) {
  const [rows, setRows] = useState<ThreadDataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [location, setLocation] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [rrule, setRrule] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listThreadData(installation.id, { limit: 200 });
      setRows(data); setError(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [installation.id]);

  const now = Date.now();
  const events = useMemo(() => {
    return rows
      .map((r) => ({ row: r, e: r.data as CalendarEvent }))
      .filter((x) => x.e?.start_at)
      .sort((a, b) => new Date(a.e.start_at).getTime() - new Date(b.e.start_at).getTime());
  }, [rows]);

  const upcoming = events.filter((x) => new Date(x.e.start_at).getTime() >= now);
  const past = events.filter((x) => new Date(x.e.start_at).getTime() < now).reverse();
  const visible = tab === "upcoming" ? upcoming : past;

  const reset = () => {
    setEditId(null); setTitle(""); setDescription(""); setStart(""); setEnd("");
    setLocation(""); setRecurring(false); setRrule(""); setShowForm(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !start) return;
    setSubmitting(true);
    try {
      const payload: CalendarEvent = {
        title: title.trim(),
        description: description.trim() || undefined,
        start_at: new Date(start).toISOString(),
        end_at: end ? new Date(end).toISOString() : undefined,
        location: location.trim() || undefined,
        is_recurring: recurring,
        recurrence_rule: recurring ? rrule.trim() || undefined : undefined,
      };
      if (editId) {
        await updateThreadData(editId, payload);
      } else {
        await createThreadData(installation.id, payload);
      }
      reset();
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  const startEdit = (row: ThreadDataRow) => {
    const e = row.data as CalendarEvent;
    setEditId(row.id);
    setTitle(e.title || "");
    setDescription(e.description || "");
    // datetime-local needs YYYY-MM-DDTHH:mm
    setStart(e.start_at ? new Date(e.start_at).toISOString().slice(0, 16) : "");
    setEnd(e.end_at ? new Date(e.end_at).toISOString().slice(0, 16) : "");
    setLocation(e.location || "");
    setRecurring(!!e.is_recurring);
    setRrule(e.recurrence_rule || "");
    setShowForm(true);
  };

  const remove = async (id: string) => {
    if (!confirm("이 일정을 삭제할까요?")) return;
    try { await deleteThreadData(id); await load(); } catch (e: any) { setError(e.message); }
  };

  const exportICS = () => {
    const ics = buildICS(events);
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "calendar.ics";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border-[3px] border-nu-ink p-4 bg-white shadow-[4px_4px_0_0_#0D0F14] space-y-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="font-head text-lg font-extrabold text-nu-ink">📅 캘린더</h3>
        <div className="flex gap-2 items-center">
          <button onClick={exportICS} className="border-[2px] border-nu-ink bg-white font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 hover:bg-nu-cream">
            📥 ICS
          </button>
          <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">{events.length} events</span>
        </div>
      </div>

      <div className="flex gap-1">
        <button onClick={() => setTab("upcoming")}
          className={`border-[2px] border-nu-ink px-3 py-1 font-mono-nu text-[11px] uppercase tracking-widest ${tab === "upcoming" ? "bg-nu-ink text-white" : "bg-white"}`}>
          📅 다가오는 ({upcoming.length})
        </button>
        <button onClick={() => setTab("past")}
          className={`border-[2px] border-nu-ink px-3 py-1 font-mono-nu text-[11px] uppercase tracking-widest ${tab === "past" ? "bg-nu-ink text-white" : "bg-white"}`}>
          📜 지난 ({past.length})
        </button>
      </div>

      {error && <div className="border-[2px] border-amber-500 bg-amber-50 p-2 text-[11px] font-mono">{error}</div>}

      {canEdit && (
        <div>
          {!showForm ? (
            <button onClick={() => setShowForm(true)}
              className="border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[11px] uppercase tracking-widest font-bold px-3 py-1 shadow-[2px_2px_0_0_#0D0F14] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#0D0F14] transition">
              + 일정 추가
            </button>
          ) : (
            <form onSubmit={submit} className="space-y-2 border-[2px] border-nu-ink/30 p-3 bg-nu-cream/30">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목 *" required
                className="w-full border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono" />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="설명" rows={2}
                className="w-full border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono" />
              <div className="flex gap-2 flex-wrap">
                <label className="text-[10px] font-mono">시작 *
                  <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required
                    className="block border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono" />
                </label>
                <label className="text-[10px] font-mono">끝
                  <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)}
                    className="block border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono" />
                </label>
              </div>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="장소"
                className="w-full border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono" />
              <label className="flex items-center gap-1 text-[11px] font-mono">
                <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
                반복
              </label>
              {recurring && (
                <input value={rrule} onChange={(e) => setRrule(e.target.value)} placeholder="RRULE (예: FREQ=WEEKLY;BYDAY=MO)"
                  className="w-full border-[2px] border-nu-ink/50 px-2 py-1 text-xs font-mono" />
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={reset} className="font-mono-nu text-[11px] text-nu-muted">취소</button>
                <button disabled={submitting}
                  className="border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[11px] uppercase tracking-widest font-bold px-3 py-1 shadow-[2px_2px_0_0_#0D0F14] disabled:opacity-50">
                  {submitting ? "..." : editId ? "수정" : "추가"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-[11px] font-mono text-nu-muted">로딩...</div>
      ) : visible.length === 0 ? (
        <div className="text-[11px] font-mono text-nu-muted">
          {tab === "upcoming" ? "다가오는 일정이 없어요." : "지난 일정이 없어요."}
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map(({ row, e }) => {
            const isOwner = row.created_by === currentUserId;
            return (
              <li key={row.id} className="border-[2px] border-nu-ink p-2 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-bold text-sm text-nu-ink">
                      {e.is_recurring && <span className="mr-1">🔁</span>}
                      {e.title}
                    </div>
                    <div className="text-[11px] font-mono text-nu-muted mt-0.5">
                      🕒 {fmt(e.start_at)}{e.end_at ? ` ~ ${fmt(e.end_at)}` : ""}
                    </div>
                    {e.location && <div className="text-[11px] font-mono text-nu-muted">📍 {e.location}</div>}
                    {e.description && <div className="text-[12px] mt-1 text-nu-ink/80 whitespace-pre-wrap">{e.description}</div>}
                  </div>
                  {canEdit && isOwner && (
                    <div className="flex flex-col gap-1">
                      <button onClick={() => startEdit(row)} className="text-[10px] font-mono text-nu-muted hover:text-nu-ink">수정</button>
                      <button onClick={() => remove(row.id)} className="text-[10px] font-mono text-nu-muted hover:text-nu-pink">삭제</button>
                    </div>
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
  slug: "calendar",
  name: "📅 캘린더",
  description: "너트 일정 — 다가오는/지난, ICS 내보내기 지원.",
  icon: "📅",
  category: "communication",
  scope: ["nut"],
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      start_at: { type: "string", format: "date-time" },
      end_at: { type: "string", format: "date-time" },
      location: { type: "string" },
      is_recurring: { type: "boolean", default: false },
      recurrence_rule: { type: "string", description: "RRULE format" },
    },
    required: ["title", "start_at"],
  },
  Component: CalendarComponent,
  isCore: true,
  version: "1.0.0",
});
