"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, RefreshCw, ClipboardCopy, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface HealthResponse {
  configured: boolean;
  missing_env: string[];
  bucket_reachable: boolean | null;
  bucket_error?: string;
  presign_ok: boolean | null;
  presign_error?: string;
  public_url_example: string | null;
  advice: string[];
}

const ALL_ENV_VARS: Array<{ key: string; hint: string }> = [
  { key: "R2_ACCOUNT_ID",        hint: "Cloudflare dashboard → R2 → 상단의 'Account ID' 복사 → Vercel env 에 추가" },
  { key: "R2_ACCESS_KEY_ID",     hint: "Cloudflare R2 → Manage R2 API Tokens → Create API Token(Object Read & Write)" },
  { key: "R2_SECRET_ACCESS_KEY", hint: "위 토큰 발급 시 함께 나오는 secret access key (재조회 불가 — 잃어버리면 재발급)" },
  { key: "R2_BUCKET",            hint: "생성한 버킷 이름 (예: nutunion-media)" },
  { key: "R2_PUBLIC_URL",        hint: "R2 bucket Settings → Public access 설정 → 커스텀 도메인(예: https://cdn.nutunion.co.kr) 또는 r2.dev 퍼블릭 URL" },
];

const CORS_JSON = `[
  {
    "AllowedOrigins": ["https://nutunion.co.kr", "https://*.vercel.app", "http://localhost:3000"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]`;

export function StorageHealthClient() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [corsOpen, setCorsOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/storage/r2-health", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "health check 실패");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const copy = (s: string) => {
    navigator.clipboard.writeText(s).then(
      () => toast.success("복사됨"),
      () => toast.error("복사 실패"),
    );
  };

  if (loading && !data) {
    return (
      <div className="border-[3px] border-nu-ink bg-nu-cream p-8 text-center font-mono-nu text-[12px] text-nu-graphite">
        <Loader2 size={18} className="animate-spin text-nu-pink mx-auto mb-2" />
        R2 상태 확인 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-[3px] border-red-600 bg-red-50 p-6">
        <div className="font-mono-nu text-[11px] uppercase tracking-widest text-red-700 mb-1">오류</div>
        <p className="text-[13px] text-red-700">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const allOk = data.configured && data.bucket_reachable === true && data.presign_ok === true;

  return (
    <>
      {/* 요약 */}
      <section className={`border-[3px] ${allOk ? "border-green-600 bg-green-50" : "border-orange-500 bg-orange-50"} p-4 mb-4`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {allOk ? (
              <>
                <CheckCircle2 size={18} className="text-green-700" />
                <span className="font-bold text-[14px] text-green-700">R2 정상 — 업로드 가능</span>
              </>
            ) : (
              <>
                <AlertTriangle size={18} className="text-orange-700" />
                <span className="font-bold text-[14px] text-orange-700">
                  {data.configured ? "R2 설정 불완전 — Supabase fallback 중" : "R2 미구성 — Supabase fallback 중"}
                </span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="h-9 px-3 border-[2px] border-nu-ink bg-nu-cream text-nu-ink font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink hover:text-nu-paper disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            다시 체크
          </button>
        </div>
      </section>

      {/* Env Vars */}
      <section className="border-[3px] border-nu-ink bg-nu-paper mb-4">
        <div className="px-4 py-2 border-b-[2px] border-nu-ink bg-nu-ink text-nu-paper font-mono-nu text-[11px] uppercase tracking-widest">
          환경변수 (5)
        </div>
        <ul className="divide-y divide-nu-ink/10 list-none m-0 p-0">
          {ALL_ENV_VARS.map(({ key, hint }) => {
            const missing = data.missing_env.includes(key);
            return (
              <li key={key} className="p-3 flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  {missing
                    ? <XCircle size={16} className="text-red-600" />
                    : <CheckCircle2 size={16} className="text-green-700" />}
                </div>
                <div className="flex-1 min-w-0">
                  <code className="font-mono-nu text-[12px] font-bold text-nu-ink">{key}</code>
                  {missing && (
                    <div className="font-mono-nu text-[11px] text-orange-700 mt-1 leading-relaxed">
                      💡 {hint}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Bucket / Presign */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="border-[3px] border-nu-ink bg-nu-paper p-4">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1">HeadBucket</div>
          <div className="flex items-center gap-2">
            {data.bucket_reachable === null ? (
              <span className="font-mono-nu text-[12px] text-nu-graphite">— (미구성 — 생략)</span>
            ) : data.bucket_reachable ? (
              <><CheckCircle2 size={14} className="text-green-700" /><span className="text-[13px] text-green-700 font-bold">접근 성공</span></>
            ) : (
              <><XCircle size={14} className="text-red-600" /><span className="text-[13px] text-red-600 font-bold">접근 실패</span></>
            )}
          </div>
          {data.bucket_error && (
            <pre className="mt-2 text-[10px] text-red-700 bg-red-50 border border-red-200 p-2 overflow-auto whitespace-pre-wrap">{data.bucket_error}</pre>
          )}
        </div>

        <div className="border-[3px] border-nu-ink bg-nu-paper p-4">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1">Presigned PUT URL</div>
          <div className="flex items-center gap-2">
            {data.presign_ok === null ? (
              <span className="font-mono-nu text-[12px] text-nu-graphite">— (미구성 — 생략)</span>
            ) : data.presign_ok ? (
              <><CheckCircle2 size={14} className="text-green-700" /><span className="text-[13px] text-green-700 font-bold">발급 성공</span></>
            ) : (
              <><XCircle size={14} className="text-red-600" /><span className="text-[13px] text-red-600 font-bold">발급 실패</span></>
            )}
          </div>
          {data.presign_error && (
            <pre className="mt-2 text-[10px] text-red-700 bg-red-50 border border-red-200 p-2 overflow-auto whitespace-pre-wrap">{data.presign_error}</pre>
          )}
        </div>
      </section>

      {/* Public URL 예시 */}
      {data.public_url_example && (
        <section className="border-[3px] border-nu-ink bg-nu-paper p-4 mb-4">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1">Public URL 예시</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono-nu text-[11px] text-nu-ink bg-nu-cream/50 border border-nu-ink/10 p-2 overflow-auto">
              {data.public_url_example}
            </code>
            <button
              type="button"
              onClick={() => copy(data.public_url_example!)}
              className="h-8 px-2 border-[2px] border-nu-ink bg-nu-paper font-mono-nu text-[10px] uppercase tracking-widest hover:bg-nu-ink hover:text-nu-paper inline-flex items-center gap-1"
            >
              <ClipboardCopy size={11} /> 복사
            </button>
          </div>
        </section>
      )}

      {/* Advice */}
      {data.advice.length > 0 && (
        <section className="border-[3px] border-dashed border-nu-pink bg-nu-pink/5 p-4 mb-4">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink mb-2">📋 다음 할 일</div>
          <ol className="text-[12px] text-nu-ink space-y-1.5 leading-relaxed list-decimal pl-5">
            {data.advice.map((a, i) => <li key={i}>{a}</li>)}
          </ol>
        </section>
      )}

      {/* CORS 설정 안내 */}
      <section className="border-[3px] border-nu-ink bg-nu-paper mb-4">
        <button
          type="button"
          onClick={() => setCorsOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 font-mono-nu text-[12px] uppercase tracking-widest text-nu-ink hover:bg-nu-cream/50"
        >
          <span>CORS 설정 안내</span>
          <ChevronDown size={13} className={`transition-transform ${corsOpen ? "rotate-180" : ""}`} />
        </button>
        {corsOpen && (
          <div className="px-4 pb-4 border-t-[2px] border-nu-ink/10">
            <p className="text-[12px] text-nu-graphite mt-3 mb-2 leading-relaxed">
              브라우저에서 PUT 업로드가 되려면 R2 버킷의 CORS 설정이 필요합니다.
              Cloudflare R2 대시보드 → 해당 버킷 → <b>Settings</b> → <b>CORS Policy</b> 에 아래 JSON 붙여넣기:
            </p>
            <div className="relative">
              <pre className="text-[11px] bg-nu-ink text-nu-paper p-3 overflow-auto whitespace-pre">{CORS_JSON}</pre>
              <button
                type="button"
                onClick={() => copy(CORS_JSON)}
                className="absolute top-2 right-2 h-7 px-2 border border-nu-paper/30 bg-nu-ink text-nu-paper font-mono-nu text-[10px] uppercase tracking-widest hover:bg-nu-pink inline-flex items-center gap-1"
              >
                <ClipboardCopy size={10} /> 복사
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
