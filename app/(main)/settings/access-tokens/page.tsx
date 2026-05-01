"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Copy, Check, Key } from "lucide-react";
import { toast } from "sonner";

interface Token {
  id: string;
  name: string;
  prefix: string;
  scope: string[];
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export default function AccessTokensPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<string[]>(["read"]);
  const [expiresInDays, setExpiresInDays] = useState<number | "">(90);
  const [justIssued, setJustIssued] = useState<{ token: string; record: Token } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/settings/access-tokens")
      .then((r) => r.json())
      .then((j: { tokens: Token[] }) => setTokens(j.tokens ?? []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  async function create() {
    if (!name.trim()) {
      toast.error("이름을 입력하세요");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/settings/access-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          scope,
          expires_in_days: expiresInDays === "" ? undefined : Number(expiresInDays),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "발급 실패");
      setJustIssued({ token: j.token, record: j.record });
      setTokens((prev) => [j.record, ...prev]);
      setName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "실패");
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string, displayName: string) {
    if (!window.confirm(`"${displayName}" 토큰을 폐기할까요?`)) return;
    setTokens((prev) => prev.filter((t) => t.id !== id));
    try {
      await fetch(`/api/settings/access-tokens/${id}`, { method: "DELETE" });
      toast.success("토큰 폐기");
    } catch {
      toast.error("폐기 실패");
    }
  }

  async function copyToken() {
    if (!justIssued) return;
    try {
      await navigator.clipboard.writeText(justIssued.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("복사 실패");
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <header className="border-b-[2px] border-nu-ink/10 pb-3">
        <div className="flex items-center gap-2 font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink">
          <Key size={11} /> Personal Access Token
        </div>
        <h1 className="font-head text-[20px] font-extrabold text-nu-ink mt-1">API 키 관리</h1>
        <p className="text-[12px] text-nu-muted mt-1">
          외부에서 nutunion API 호출용 토큰. 발급 후 평문은 1회만 표시 — 안전한 곳에 보관하세요.
        </p>
      </header>

      {/* 발급 직후 — 평문 노출 */}
      {justIssued && (
        <div className="bg-emerald-50 border-[2px] border-emerald-700 p-3 space-y-2">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-emerald-800">
            ✓ 발급 완료 — 이 화면을 닫으면 다시 볼 수 없습니다
          </div>
          <div className="flex items-center gap-1">
            <input
              type="text"
              readOnly
              value={justIssued.token}
              onFocus={(e) => e.target.select()}
              className="flex-1 px-2 py-1 text-[11px] font-mono-nu bg-white border border-nu-ink/20 outline-none"
            />
            <button
              type="button"
              onClick={copyToken}
              className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border-[2px] border-nu-ink bg-nu-ink text-nu-paper flex items-center gap-1"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? "복사됨" : "복사"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setJustIssued(null)}
            className="font-mono-nu text-[10px] uppercase tracking-widest text-emerald-800 hover:underline"
          >
            닫고 토큰 숨기기
          </button>
        </div>
      )}

      {/* 발급 폼 */}
      <section className="bg-white border-[2px] border-nu-ink p-3 space-y-2">
        <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
          새 토큰 발급
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름 — 예: 'CLI 자동화'"
          maxLength={60}
          className="w-full px-2 py-1.5 text-[12px] border-[2px] border-nu-ink/30 focus:border-nu-ink outline-none"
        />
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1">scope</div>
            <div className="flex gap-1">
              {(["read", "write", "admin"] as const).map((s) => {
                const checked = scope.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScope((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])}
                    className={`font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border-[2px] ${checked ? "bg-nu-ink text-nu-paper border-nu-ink" : "border-nu-ink/30 hover:bg-nu-cream"}`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1">만료</div>
            <select
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value === "" ? "" : Number(e.target.value))}
              className="px-2 py-1 text-[11px] border-[2px] border-nu-ink/30 outline-none"
            >
              <option value={30}>30일</option>
              <option value={90}>90일</option>
              <option value={365}>365일</option>
              <option value="">만료 없음</option>
            </select>
          </div>
          <button
            type="button"
            onClick={create}
            disabled={creating || !name.trim()}
            className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink bg-nu-ink text-nu-paper disabled:opacity-30 flex items-center gap-1 ml-auto"
          >
            {creating ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            발급
          </button>
        </div>
      </section>

      {/* 토큰 목록 */}
      <section>
        <h2 className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">
          내 토큰 · {tokens.length}
        </h2>
        {loading ? (
          <div className="flex items-center gap-1.5 text-[12px] text-nu-muted">
            <Loader2 size={11} className="animate-spin" /> 로드 중…
          </div>
        ) : tokens.length === 0 ? (
          <div className="text-[12px] text-nu-muted italic">발급된 토큰 없음</div>
        ) : (
          <ul className="space-y-1">
            {tokens.map((t) => (
              <li key={t.id} className="bg-white border-[2px] border-nu-ink/15 hover:border-nu-ink px-3 py-2 flex items-start gap-2">
                <Key size={12} className="text-nu-pink mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-nu-ink">{t.name}</div>
                  <div className="font-mono-nu text-[10px] text-nu-muted">
                    {t.prefix}… · scope {t.scope.join("/")}
                  </div>
                  <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mt-0.5">
                    {t.last_used_at ? `마지막 사용 ${new Date(t.last_used_at).toLocaleDateString("ko")}` : "사용 기록 없음"}
                    {t.expires_at && ` · 만료 ${new Date(t.expires_at).toLocaleDateString("ko")}`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(t.id, t.name)}
                  className="text-nu-muted hover:text-red-600 p-1"
                  title="폐기"
                >
                  <Trash2 size={11} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
