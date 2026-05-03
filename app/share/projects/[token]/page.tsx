"use client";

import { useEffect, useState, useCallback, use } from "react";
import {
  Lock, Mail, Loader2, Eye, MessageSquare, Upload, Edit3, AlertTriangle,
  Calendar, FileText, ListChecks, ShieldCheck, Briefcase,
} from "lucide-react";

/**
 * /share/projects/[token]
 *   외부 공유 뷰어 — 로그인 불필요. 비밀번호 / 이메일 인증 인터뷰 후 데이터 표시.
 *
 *   링크 생성자가 설정한 scope 영역만 노출. (개요/마일스톤/파일/회의/정산/결정/리스크)
 */

const PERM_LABEL = {
  view: "보기 전용",
  comment: "댓글 가능",
  upload: "업로드 가능",
  edit_limited: "제한 편집 가능",
} as const;

const PERM_ICON = {
  view: Eye, comment: MessageSquare, upload: Upload, edit_limited: Edit3,
} as const;

interface SharedData {
  permission: keyof typeof PERM_LABEL;
  label: string | null;
  allow_download: boolean;
  project: { id: string; title: string; description?: string; status?: string; deadline?: string; total_budget?: string; type?: string };
  milestones: Array<{ id: string; title: string; description?: string; status: string; due_date: string | null }>;
  files: Array<{ id: string; filename: string; file_size: number; mime_type: string; created_at: string }>;
  meetings: Array<{ id: string; title: string; scheduled_at: string; status: string; summary: string | null }>;
  decisions: Array<{ id: string; title: string; rationale: string | null; decided_at: string }>;
  risks: Array<{ id: string; title: string; description: string | null; severity: "low"|"medium"|"high"|"critical"; status: string; due_at: string | null }>;
}

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<SharedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [needPassword, setNeedPassword] = useState(false);
  const [needEmail, setNeedEmail] = useState(false);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (pwd?: string, eml?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (pwd) params.set("password", pwd);
      if (eml) params.set("email", eml);
      const r = await fetch(`/api/share/projects/${token}?${params}`);
      if (r.status === 401) {
        const j = await r.json();
        if (j.error === "password_required") setNeedPassword(true);
        else if (j.error === "email_required") setNeedEmail(true);
        else setError("인증 실패");
        return;
      }
      if (r.status === 410) {
        const j = await r.json();
        setError(j.error === "expired" ? "이 링크는 만료되었습니다" : "이 링크는 폐기되었습니다");
        return;
      }
      if (!r.ok) {
        setError("링크를 찾을 수 없습니다");
        return;
      }
      const j = await r.json();
      setData(j as SharedData);
      setNeedPassword(false);
      setNeedEmail(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "로드 실패");
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data && !error && !needPassword && !needEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-nu-paper">
        <div className="flex items-center gap-2 text-sm text-nu-graphite">
          <Loader2 size={16} className="animate-spin" /> 로드 중…
        </div>
      </div>
    );
  }

  // 인증 화면
  if (needPassword || needEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-nu-paper p-4">
        <div className="bg-white border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] max-w-md w-full p-6">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink mb-3 flex items-center gap-1.5">
            <Lock size={11} /> 외부 공유 — 인증 필요
          </div>
          <h1 className="font-head text-xl font-extrabold text-nu-ink mb-4">접근 인증</h1>
          <form onSubmit={(e) => {
            e.preventDefault();
            setSubmitting(true);
            load(password, email).finally(() => setSubmitting(false));
          }} className="space-y-3">
            {needEmail && (
              <div>
                <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1 flex items-center gap-1">
                  <Mail size={9} /> 이메일
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 border-[2px] border-nu-ink/20 focus:border-nu-pink outline-none text-sm"
                />
              </div>
            )}
            {needPassword && (
              <div>
                <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1 flex items-center gap-1">
                  <Lock size={9} /> 비밀번호
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border-[2px] border-nu-ink/20 focus:border-nu-pink outline-none text-sm"
                />
              </div>
            )}
            {error && <div className="text-[12px] text-red-700">{error}</div>}
            <button type="submit" disabled={submitting}
              className="w-full font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-2 bg-nu-ink text-nu-paper hover:bg-nu-graphite inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
              {submitting ? <Loader2 size={11} className="animate-spin" /> : null} 접근
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-nu-paper p-4">
        <div className="text-center">
          <AlertTriangle size={32} className="text-nu-muted mx-auto mb-2" />
          <div className="text-sm text-nu-graphite">{error || "링크를 찾을 수 없습니다"}</div>
        </div>
      </div>
    );
  }

  const PermIcon = PERM_ICON[data.permission];

  return (
    <div className="min-h-screen bg-nu-paper">
      {/* 외부 공유 헤더 — 권한 + 라벨 */}
      <header className="border-b-[3px] border-nu-ink bg-white">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Briefcase size={16} className="text-nu-pink" />
            <h1 className="font-head text-lg font-extrabold text-nu-ink">{data.project.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono-nu text-[10px] uppercase tracking-widest bg-nu-pink/10 text-nu-pink px-2 py-0.5 inline-flex items-center gap-1 border border-nu-pink/30">
              <PermIcon size={10} /> {PERM_LABEL[data.permission]}
            </span>
            {data.label && (
              <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
                {data.label}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 개요 */}
        {data.project.description && (
          <section className="bg-white border-2 border-nu-ink/[0.08] p-4">
            <h2 className="font-head text-base font-extrabold text-nu-ink mb-2">소개</h2>
            <p className="text-[14px] text-nu-graphite whitespace-pre-wrap leading-relaxed">{data.project.description}</p>
          </section>
        )}

        {data.milestones.length > 0 && (
          <Section title="마일스톤" icon={ListChecks} count={data.milestones.length}>
            <ul className="space-y-2 list-none p-0 m-0">
              {data.milestones.map((m) => (
                <li key={m.id} className="bg-white border-l-[3px] border-nu-blue p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[14px] text-nu-ink">{m.title}</span>
                    <span className={`font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 ${
                      m.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                      m.status === "in_progress" ? "bg-amber-50 text-amber-700" :
                      "bg-nu-ink/5 text-nu-muted"
                    }`}>{m.status}</span>
                  </div>
                  {m.description && <p className="text-[12px] text-nu-graphite mt-1 leading-snug">{m.description}</p>}
                  {m.due_date && (
                    <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mt-1 flex items-center gap-1">
                      <Calendar size={9} /> {new Date(m.due_date).toLocaleDateString("ko")}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {data.decisions.length > 0 && (
          <Section title="결정 로그" icon={ListChecks} count={data.decisions.length}>
            <ul className="space-y-1.5 list-none p-0 m-0">
              {data.decisions.map((d) => (
                <li key={d.id} className="bg-white border-l-[3px] border-nu-blue px-3 py-2">
                  <div className="text-[13px] font-bold text-nu-ink">{d.title}</div>
                  {d.rationale && <div className="text-[11px] text-nu-graphite mt-0.5">{d.rationale}</div>}
                  <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mt-0.5">
                    {new Date(d.decided_at).toLocaleDateString("ko")}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {data.risks.length > 0 && (
          <Section title="리스크" icon={ShieldCheck} count={data.risks.length}>
            <ul className="space-y-1.5 list-none p-0 m-0">
              {data.risks.map((r) => (
                <li key={r.id} className={`bg-white border-2 px-3 py-2 ${
                  r.severity === "critical" ? "border-red-300 bg-red-50" :
                  r.severity === "high" ? "border-orange-200 bg-orange-50" :
                  r.severity === "medium" ? "border-amber-200 bg-amber-50" :
                  "border-emerald-200 bg-emerald-50"
                }`}>
                  <div className="text-[13px] font-bold text-nu-ink">{r.title}</div>
                  {r.description && <div className="text-[11px] text-nu-graphite mt-0.5 leading-snug">{r.description}</div>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {data.files.length > 0 && (
          <Section title="파일" icon={FileText} count={data.files.length}>
            <ul className="space-y-1 list-none p-0 m-0">
              {data.files.map((f) => (
                <li key={f.id} className="bg-white border border-nu-ink/10 px-3 py-2 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-nu-ink truncate">{f.filename}</div>
                    <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">
                      {(f.file_size / 1024).toFixed(1)}KB · {new Date(f.created_at).toLocaleDateString("ko")}
                    </div>
                  </div>
                  {!data.allow_download && (
                    <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">다운로드 불가</span>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <footer className="text-center pt-6 pb-12 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
          NutUnion · 외부 공유 페이지
        </footer>
      </main>
    </div>
  );
}

function Section({ title, icon: Icon, count, children }: {
  title: string;
  icon: typeof FileText;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-head text-base font-extrabold text-nu-ink mb-2 flex items-center gap-1.5">
        <Icon size={14} className="text-nu-pink" /> {title}
        <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">{count}</span>
      </h2>
      {children}
    </section>
  );
}
