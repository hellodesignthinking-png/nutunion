"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Share2, X, Plus, Trash2, Eye, MessageSquare, Upload, Edit3,
  Lock, Mail, Download, Copy, Check, Calendar, Loader2, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface ShareLink {
  id: string;
  token: string;
  permission: "view" | "comment" | "upload" | "edit_limited";
  label: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  created_at: string;
  require_email: boolean;
  allow_download: boolean;
  show_overview: boolean;
  show_milestones: boolean;
  show_files: boolean;
  show_meetings: boolean;
  show_finance: boolean;
  show_decisions: boolean;
  show_risks: boolean;
}

const PERM_META = {
  view:         { icon: Eye,         label: "보기만",      desc: "내용을 볼 수만 있음" },
  comment:      { icon: MessageSquare, label: "댓글 가능",  desc: "보기 + 댓글 작성" },
  upload:       { icon: Upload,      label: "파일 업로드",  desc: "보기 + 댓글 + 파일 첨부" },
  edit_limited: { icon: Edit3,       label: "제한 편집",    desc: "보기 + 댓글 + 업로드 + 일부 영역 편집" },
} as const;

const SCOPES: Array<{ key: keyof ShareLink; label: string }> = [
  { key: "show_overview",   label: "개요" },
  { key: "show_milestones", label: "마일스톤" },
  { key: "show_files",      label: "파일" },
  { key: "show_meetings",   label: "회의록" },
  { key: "show_finance",    label: "정산" },
  { key: "show_decisions",  label: "결정 로그" },
  { key: "show_risks",      label: "리스크" },
];

interface Props {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

export function ProjectShareModal({ projectId, open, onClose }: Props) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    permission: "view" as ShareLink["permission"],
    label: "",
    password: "",
    require_email: false,
    allow_download: true,
    expires_days: 0 as 0 | 7 | 30 | 90,
    scope: {
      show_overview: true,
      show_milestones: true,
      show_files: false,
      show_meetings: false,
      show_finance: false,
      show_decisions: false,
      show_risks: false,
    },
  });
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/share-links`);
      const j = await r.json();
      if (Array.isArray(j.links)) setLinks(j.links);
    } catch {} finally { setLoading(false); }
  }, [open, projectId]);
  useEffect(() => { load(); }, [load]);

  async function create() {
    setCreating(true);
    try {
      const expires_at = form.expires_days > 0
        ? new Date(Date.now() + form.expires_days * 86_400_000).toISOString()
        : null;
      const r = await fetch(`/api/projects/${projectId}/share-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          permission: form.permission,
          scope: form.scope,
          password: form.password || undefined,
          require_email: form.require_email,
          allow_download: form.allow_download,
          expires_at,
          label: form.label,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "생성 실패");
      setLinks((p) => [j.link, ...p]);
      setCreateOpen(false);
      // 클립보드에 자동 복사
      if (j.url) {
        navigator.clipboard?.writeText(j.url).catch(() => undefined);
        toast.success("링크 생성 — 클립보드에 복사됨");
      } else {
        toast.success("링크 생성");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "실패");
    } finally { setCreating(false); }
  }

  async function revoke(id: string) {
    if (!window.confirm("이 링크를 폐기할까요? 외부 사용자가 더 이상 접근할 수 없습니다.")) return;
    setLinks((p) => p.map((l) => l.id === id ? { ...l, revoked_at: new Date().toISOString() } : l));
    await fetch(`/api/projects/share-links/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revoked_at: new Date().toISOString() }),
    }).catch(() => undefined);
  }

  async function remove(id: string) {
    if (!window.confirm("이 링크를 영구 삭제할까요?")) return;
    setLinks((p) => p.filter((l) => l.id !== id));
    await fetch(`/api/projects/share-links/${id}`, { method: "DELETE" }).catch(() => undefined);
  }

  function copyUrl(token: string) {
    const u = `${window.location.origin}/share/projects/${token}`;
    navigator.clipboard?.writeText(u).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    }).catch(() => undefined);
  }

  if (!open) return null;
  const PIcon = PERM_META[form.permission].icon;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-nu-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-nu-paper border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] max-w-2xl w-full max-h-[88vh] overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b-[3px] border-nu-ink bg-white flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink">
            <Share2 size={11} /> 외부 공유 링크
          </div>
          <button onClick={onClose} className="p-1 text-nu-muted hover:text-nu-ink"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-4">
          {/* 새 링크 생성 폼 */}
          {!createOpen ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="w-full font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 border-[2.5px] border-nu-ink bg-nu-ink text-nu-paper hover:bg-nu-graphite inline-flex items-center justify-center gap-1.5"
            >
              <Plus size={12} /> 새 공유 링크 만들기
            </button>
          ) : (
            <section className="bg-white border-[2px] border-nu-ink/15 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink">새 링크</div>
                <button onClick={() => setCreateOpen(false)} className="text-nu-muted hover:text-nu-ink"><X size={14} /></button>
              </div>
              <input
                value={form.label}
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                placeholder="용도 라벨 — 예: '감정평가사 박○○', '투자자 미팅용'"
                maxLength={80}
                className="w-full px-2 py-1.5 text-[12px] border-[2px] border-nu-ink/15 focus:border-nu-pink outline-none"
              />

              {/* 권한 4단 */}
              <div>
                <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1">권한</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
                  {(Object.keys(PERM_META) as Array<keyof typeof PERM_META>).map((k) => {
                    const Icon = PERM_META[k].icon;
                    const active = form.permission === k;
                    return (
                      <button key={k} type="button"
                        onClick={() => setForm((p) => ({ ...p, permission: k }))}
                        className={`text-left px-2 py-1.5 border-[2px] ${
                          active ? "bg-nu-ink text-nu-paper border-nu-ink" : "border-nu-ink/15 hover:border-nu-ink/40"
                        }`}>
                        <Icon size={12} />
                        <div className="font-mono-nu text-[10px] uppercase tracking-widest mt-0.5">{PERM_META[k].label}</div>
                        <div className={`text-[9px] mt-0.5 leading-tight ${active ? "text-nu-paper/70" : "text-nu-muted"}`}>{PERM_META[k].desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 노출 영역 */}
              <div>
                <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1">노출 영역</div>
                <div className="flex flex-wrap gap-1">
                  {SCOPES.map((s) => {
                    const active = form.scope[s.key as keyof typeof form.scope];
                    return (
                      <button key={s.key as string} type="button"
                        onClick={() => setForm((p) => ({ ...p, scope: { ...p.scope, [s.key]: !active } }))}
                        className={`font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 border-[2px] ${
                          active ? "bg-nu-pink/20 border-nu-pink text-nu-pink" : "border-nu-ink/15 text-nu-muted hover:border-nu-ink/40"
                        }`}>
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 보안 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1 flex items-center gap-1"><Lock size={9} /> 비밀번호 (선택)</div>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="없으면 비워두기"
                    className="w-full px-2 py-1 text-[11px] border-[2px] border-nu-ink/15 focus:border-nu-pink outline-none"
                  />
                </div>
                <div>
                  <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1 flex items-center gap-1"><Calendar size={9} /> 만료</div>
                  <select
                    value={form.expires_days}
                    onChange={(e) => setForm((p) => ({ ...p, expires_days: Number(e.target.value) as typeof p.expires_days }))}
                    className="w-full px-2 py-1 text-[11px] border-[2px] border-nu-ink/15 focus:border-nu-pink outline-none"
                  >
                    <option value={0}>없음</option>
                    <option value={7}>7일</option>
                    <option value={30}>30일</option>
                    <option value={90}>90일</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap text-[11px]">
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={form.require_email} onChange={(e) => setForm((p) => ({ ...p, require_email: e.target.checked }))} />
                  <Mail size={10} /> 이메일 인증 강제
                </label>
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={form.allow_download} onChange={(e) => setForm((p) => ({ ...p, allow_download: e.target.checked }))} />
                  <Download size={10} /> 다운로드 허용
                </label>
              </div>

              <button onClick={create} disabled={creating}
                className="w-full font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-2 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
                {creating ? <Loader2 size={11} className="animate-spin" /> : <PIcon size={11} />} 링크 생성
              </button>
            </section>
          )}

          {/* 기존 링크 목록 */}
          <section>
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">
              내 링크 · {links.length}
            </div>
            {loading ? (
              <div className="text-[12px] text-nu-muted flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> 로드 중…</div>
            ) : links.length === 0 ? (
              <div className="text-[12px] text-nu-muted italic">발급한 링크 없음</div>
            ) : (
              <ul className="space-y-1.5">
                {links.map((l) => {
                  const PermIcon = PERM_META[l.permission].icon;
                  const isExpired = l.expires_at && new Date(l.expires_at) < new Date();
                  const isRevoked = !!l.revoked_at;
                  const active = !isExpired && !isRevoked;
                  return (
                    <li key={l.id} className={`bg-white border-[2px] ${active ? "border-nu-ink/15" : "border-nu-ink/8 opacity-60"} px-3 py-2`}>
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <PermIcon size={12} className="text-nu-pink shrink-0" />
                            <span className="text-[13px] font-bold text-nu-ink">{l.label || PERM_META[l.permission].label}</span>
                            {isRevoked && <span className="font-mono-nu text-[9px] uppercase tracking-widest bg-red-50 text-red-700 px-1">폐기됨</span>}
                            {isExpired && !isRevoked && <span className="font-mono-nu text-[9px] uppercase tracking-widest bg-nu-ink/5 text-nu-muted px-1">만료</span>}
                          </div>
                          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>조회 {l.view_count}회</span>
                            {l.last_viewed_at && <span>· 마지막 {new Date(l.last_viewed_at).toLocaleDateString("ko")}</span>}
                            {l.expires_at && <span>· 만료 {new Date(l.expires_at).toLocaleDateString("ko")}</span>}
                          </div>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {SCOPES.filter((s) => l[s.key as keyof typeof l]).map((s) => (
                              <span key={s.key as string} className="font-mono-nu text-[8.5px] uppercase tracking-widest bg-nu-cream px-1 border border-nu-ink/15">
                                {s.label}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {active && (
                            <button onClick={() => copyUrl(l.token)} title="URL 복사" className="p-1 text-nu-muted hover:text-nu-pink">
                              {copiedToken === l.token ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                            </button>
                          )}
                          {active && (
                            <a href={`/share/projects/${l.token}`} target="_blank" rel="noopener noreferrer" title="새 탭에서 열기" className="p-1 text-nu-muted hover:text-nu-pink">
                              <ExternalLink size={12} />
                            </a>
                          )}
                          {!isRevoked && (
                            <button onClick={() => revoke(l.id)} title="폐기" className="p-1 text-nu-muted hover:text-red-600">
                              <Lock size={12} />
                            </button>
                          )}
                          <button onClick={() => remove(l.id)} title="삭제" className="p-1 text-nu-muted hover:text-red-600">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
