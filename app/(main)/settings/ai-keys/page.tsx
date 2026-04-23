"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Key, Loader2, CheckCircle2, XCircle, Eye, EyeOff, ChevronDown, ChevronUp, Sparkles, DollarSign, Zap, Shield, RefreshCw } from "lucide-react";

type Provider = "openai" | "anthropic" | "google";

interface Preview {
  openai: string | null;
  anthropic: string | null;
  google: string | null;
  preferred_provider: "auto" | Provider;
}

const PROVIDERS: { id: Provider; label: string; placeholder: string; docs: string }[] = [
  { id: "openai", label: "OpenAI", placeholder: "sk-proj-...", docs: "https://platform.openai.com/api-keys" },
  { id: "anthropic", label: "Anthropic", placeholder: "sk-ant-...", docs: "https://console.anthropic.com/settings/keys" },
  { id: "google", label: "Google AI (Gemini)", placeholder: "AIza...", docs: "https://aistudio.google.com/apikey" },
];

export default function AIKeysSettingsPage() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [drafts, setDrafts] = useState<Record<Provider, string>>({ openai: "", anthropic: "", google: "" });
  const [show, setShow] = useState<Record<Provider, boolean>>({ openai: false, anthropic: false, google: false });
  const [testing, setTesting] = useState<Provider | null>(null);
  const [saving, setSaving] = useState(false);
  const [preferred, setPreferred] = useState<"auto" | Provider>("auto");
  const [guideOpen, setGuideOpen] = useState(true);

  useEffect(() => {
    fetch("/api/settings/ai-keys").then((r) => r.json()).then((d) => {
      setPreview(d);
      setPreferred(d.preferred_provider || "auto");
    });
  }, []);

  async function save() {
    setSaving(true);
    const body: any = { preferred_provider: preferred };
    for (const p of PROVIDERS) {
      if (drafts[p.id].trim()) body[p.id] = drafts[p.id].trim();
    }
    try {
      const res = await fetch("/api/settings/ai-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("저장됨");
      setDrafts({ openai: "", anthropic: "", google: "" });
      // reload preview
      const d = await fetch("/api/settings/ai-keys").then((r) => r.json());
      setPreview(d);
    } catch (err: any) {
      toast.error("저장 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function test(provider: Provider) {
    setTesting(provider);
    try {
      const res = await fetch("/api/settings/ai-keys/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const d = await res.json();
      if (d.ok) toast.success(`${provider} OK — ${d.model_used || ""}`);
      else toast.error(`${provider} 실패: ${d.error || "unknown"}`);
    } finally {
      setTesting(null);
    }
  }

  async function clearKey(provider: Provider) {
    if (!confirm(`${provider} 키를 삭제할까요?`)) return;
    const res = await fetch("/api/settings/ai-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [provider]: null }),
    });
    if (res.ok) {
      toast.success("삭제됨");
      const d = await fetch("/api/settings/ai-keys").then((r) => r.json());
      setPreview(d);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <div className="mb-6">
        <h1 className="font-head text-3xl font-extrabold text-nu-ink tracking-tight flex items-center gap-2">
          <Key size={24} className="text-nu-pink" /> AI 키 볼트
        </h1>
        <p className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mt-1">
          본인 명의 API 키를 안전하게 저장 · 저장된 키는 서버에서 AES-256-GCM 암호화
        </p>
      </div>

      {/* ── 왜 연결하나요? + 어떻게 키를 얻나요? 교육 섹션 ─────────────── */}
      <div className="bg-amber-50 border-[2.5px] border-nu-ink mb-4">
        <button
          type="button"
          onClick={() => setGuideOpen(v => !v)}
          className="w-full flex items-center justify-between p-4 hover:bg-amber-100 transition-colors border-b-[2px] border-nu-ink/10"
        >
          <span className="flex items-center gap-2 font-head text-base font-extrabold text-nu-ink">
            <Sparkles size={16} className="text-nu-pink" />
            AI 키를 왜, 어떻게 연결하나요?
          </span>
          {guideOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {guideOpen && (
          <div className="p-5 space-y-6">
            {/* 왜 */}
            <section>
              <h3 className="font-head text-sm font-extrabold text-nu-ink mb-3 uppercase tracking-tight">
                왜 연결하나요?
              </h3>
              <ul className="space-y-2 text-[13px] text-nu-graphite leading-relaxed">
                <li className="flex gap-2">
                  <Zap size={14} className="shrink-0 text-nu-pink mt-0.5" />
                  <span><b>더 빠른 응답</b> — 내 키는 내 요청만 처리하므로 공용 큐 대기가 없습니다.</span>
                </li>
                <li className="flex gap-2">
                  <DollarSign size={14} className="shrink-0 text-nu-pink mt-0.5" />
                  <span><b>비용 투명</b> — 쓴 만큼 내 OpenAI/Anthropic/Google 계정에 직접 청구됩니다.</span>
                </li>
                <li className="flex gap-2">
                  <Sparkles size={14} className="shrink-0 text-nu-pink mt-0.5" />
                  <span><b>고급 모델 선택</b> — Claude Opus, GPT‑4.1, Gemini 2.5 Pro 등 최고급 모델을 직접 사용할 수 있습니다.</span>
                </li>
                <li className="flex gap-2">
                  <Shield size={14} className="shrink-0 text-nu-pink mt-0.5" />
                  <span><b>프라이버시 강화</b> — 내 데이터가 넛유니온 공용 AI 가 아닌 내 키로만 처리됩니다.</span>
                </li>
                <li className="flex gap-2">
                  <RefreshCw size={14} className="shrink-0 text-nu-pink mt-0.5" />
                  <span><b>자동 폴백</b> — 내 키가 일시적으로 실패해도 넛유니온 플랫폼 AI 가 이어서 수행합니다 (중단 없음).</span>
                </li>
              </ul>
            </section>

            {/* 어떻게 */}
            <section>
              <h3 className="font-head text-sm font-extrabold text-nu-ink mb-3 uppercase tracking-tight">
                어떻게 키를 얻나요?
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Google */}
                <div className="bg-nu-white border-[2px] border-nu-ink p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-head text-sm font-extrabold text-nu-ink">Google Gemini</h4>
                    <span className="font-mono-nu text-[9px] uppercase tracking-widest bg-green-100 text-green-700 px-1.5 py-0.5 border border-green-300">
                      추천 · 무료 티어
                    </span>
                  </div>
                  <ol className="text-[12px] text-nu-graphite space-y-1 leading-snug list-decimal list-inside">
                    <li>
                      <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-nu-blue underline">aistudio.google.com</a> 접속 → 로그인
                    </li>
                    <li>좌측 <b>Get API key</b> 클릭</li>
                    <li><b>Create API key</b> → 프로젝트 선택 또는 새로 만들기</li>
                    <li>생성된 키(<code className="font-mono-nu text-[11px]">AIza...</code>) 복사</li>
                    <li>아래 Google 필드에 붙여넣기 → 저장 → 테스트</li>
                  </ol>
                  <p className="mt-2 text-[11px] text-nu-muted">
                    무료: 하루 1,500 요청 · Gemini 2.5 Flash 사용 가능
                  </p>
                </div>

                {/* OpenAI */}
                <div className="bg-nu-white border-[2px] border-nu-ink p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-head text-sm font-extrabold text-nu-ink">OpenAI GPT-4.1</h4>
                    <span className="font-mono-nu text-[9px] uppercase tracking-widest bg-nu-ink/10 text-nu-ink px-1.5 py-0.5 border border-nu-ink/30">
                      유료
                    </span>
                  </div>
                  <ol className="text-[12px] text-nu-graphite space-y-1 leading-snug list-decimal list-inside">
                    <li>
                      <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-nu-blue underline">platform.openai.com/api-keys</a> 접속
                    </li>
                    <li><b>Create new secret key</b> 클릭</li>
                    <li>Name 입력 (예: "nutunion")</li>
                    <li>생성된 키(<code className="font-mono-nu text-[11px]">sk-proj-...</code>) 복사 — <b>한번만 표시됨</b></li>
                    <li>Usage → Billing 에서 결제 수단 등록 필요</li>
                    <li>아래 OpenAI 필드에 붙여넣기</li>
                  </ol>
                </div>

                {/* Anthropic */}
                <div className="bg-nu-white border-[2px] border-nu-ink p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-head text-sm font-extrabold text-nu-ink">Anthropic Claude</h4>
                    <span className="font-mono-nu text-[9px] uppercase tracking-widest bg-nu-ink/10 text-nu-ink px-1.5 py-0.5 border border-nu-ink/30">
                      유료
                    </span>
                  </div>
                  <ol className="text-[12px] text-nu-graphite space-y-1 leading-snug list-decimal list-inside">
                    <li>
                      <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-nu-blue underline">console.anthropic.com</a> 접속 → 로그인
                    </li>
                    <li>Settings → API Keys → <b>Create Key</b></li>
                    <li>Name 입력</li>
                    <li>생성된 키(<code className="font-mono-nu text-[11px]">sk-ant-...</code>) 복사</li>
                    <li>Settings → Billing 에서 최소 $5 크레딧 충전</li>
                    <li>아래 Anthropic 필드에 붙여넣기</li>
                  </ol>
                </div>
              </div>
            </section>

            {/* 보안 */}
            <section className="bg-nu-white border-[2px] border-nu-ink p-3">
              <h3 className="font-head text-sm font-extrabold text-nu-ink mb-2 uppercase tracking-tight flex items-center gap-1.5">
                <Shield size={14} className="text-nu-pink" /> 보안 안내
              </h3>
              <ul className="text-[12px] text-nu-graphite space-y-1 leading-snug">
                <li>🔐 <b>AES-256-GCM 암호화</b> — 저장된 키는 복호화해야만 사용 가능하며, 관리자도 평문으로 열람할 수 없습니다.</li>
                <li>🎛️ 언제든 <b>삭제</b> 버튼으로 즉시 제거 가능합니다.</li>
                <li>🔄 <b>선호 공급자</b> 설정으로 어떤 AI 를 우선 사용할지 선택할 수 있습니다.</li>
              </ul>
            </section>
          </div>
        )}
      </div>

      <div className="bg-nu-white border-[2.5px] border-nu-ink p-6 mb-4">
        <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted block mb-2">
          기본 공급자
        </label>
        <div className="flex flex-wrap gap-2">
          {([["auto", "자동"], ["openai", "OpenAI"], ["anthropic", "Anthropic"], ["google", "Google"]] as const).map(
            ([id, label]) => (
              <button
                key={id}
                onClick={() => setPreferred(id as any)}
                className={`font-mono-nu text-[12px] uppercase tracking-widest px-3 py-2 border-[2px] transition-all ${
                  preferred === id
                    ? "border-nu-ink bg-nu-ink text-nu-paper"
                    : "border-nu-ink/20 bg-transparent text-nu-graphite hover:border-nu-ink"
                }`}
              >
                {label}
              </button>
            ),
          )}
        </div>
        <p className="text-[11px] text-nu-muted mt-2">
          자동 = 저장된 키 중 우선순위(Google → OpenAI → Anthropic) 순
        </p>
      </div>

      <div className="space-y-3">
        {PROVIDERS.map((p) => {
          const existing = preview?.[p.id];
          return (
            <div key={p.id} className="bg-nu-white border-[2.5px] border-nu-ink p-5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-head text-base font-extrabold text-nu-ink">{p.label}</h3>
                  <a
                    href={p.docs}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted hover:text-nu-pink no-underline"
                  >
                    키 발급 →
                  </a>
                </div>
                {existing ? (
                  <span className="font-mono-nu text-[11px] text-nu-graphite bg-nu-ink/5 px-2 py-1 border border-nu-ink/20">
                    {existing}
                  </span>
                ) : (
                  <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted/60">없음</span>
                )}
              </div>

              <div className="flex gap-2 mt-2">
                <div className="flex-1 relative">
                  <input
                    type={show[p.id] ? "text" : "password"}
                    value={drafts[p.id]}
                    onChange={(e) => setDrafts({ ...drafts, [p.id]: e.target.value })}
                    placeholder={p.placeholder}
                    className="w-full px-3 py-2 pr-10 border-[2px] border-nu-ink/20 focus:border-nu-ink outline-none font-mono-nu text-[13px] bg-nu-paper"
                  />
                  <button
                    type="button"
                    onClick={() => setShow({ ...show, [p.id]: !show[p.id] })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-transparent border-none cursor-pointer text-nu-muted"
                  >
                    {show[p.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button
                  onClick={() => test(p.id)}
                  disabled={testing === p.id || !existing}
                  className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 border-[2px] border-nu-ink/20 hover:border-nu-ink disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  {testing === p.id ? <Loader2 size={11} className="animate-spin" /> : "테스트"}
                </button>
                {existing && (
                  <button
                    onClick={() => clearKey(p.id)}
                    className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 border-[2px] border-red-300 text-red-600 hover:bg-red-50"
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-end gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="font-mono-nu text-[12px] uppercase tracking-widest px-6 py-3 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} 저장
        </button>
      </div>

      <div className="mt-8 p-4 border-[2px] border-dashed border-nu-ink/20 text-[12px] text-nu-muted">
        <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">보안 노트</p>
        키는 저장 시점에 AES-256-GCM 으로 암호화됩니다. 서버 마스터 시크릿은 Vercel 환경변수 <code>NU_KEY_VAULT_SECRET</code>.
        클라이언트 번들에는 평문 키가 포함되지 않습니다.
      </div>
    </div>
  );
}
