"use client";

/**
 * CarriageDashboard — Carriage Bolt (플랫폼형) 전용 뷰.
 *
 * MVP:
 *  - 매장 헤더 (도메인, 런칭일, 기술스택, 목표)
 *  - Today's Pulse (DAU/MAU/uptime — 수동 입력까지 연결, 추후 Integrations 자동화)
 *  - 릴리스 타임라인 (수동 입력)
 *  - 연동 상태 (PostHog/Vercel/Sentry/Stripe — placeholder badges)
 *  - 중첩 Sprint: parent_bolt_id = this 인 Hex 볼트 목록
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Globe, Rocket, Activity, ExternalLink, Plus, GitCommit, Zap, RefreshCw, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { BoltMetricCard } from "@/components/bolt/common/bolt-metric-card";
import { fmtCompact } from "@/lib/bolt/anchor-metrics";

interface CarriageSubtype {
  launched_at: string | null;
  domain: string | null;
  app_store_url: string | null;
  tech_stack: string[] | null;
  dau_goal: number | null;
  mau_goal: number | null;
  mrr_goal_krw: number | null;
  integrations: Record<string, string> | null;
}

interface Props {
  projectId: string;
  title: string;
}

export function CarriageDashboard({ projectId, title }: Props) {
  const [carriage, setCarriage] = useState<CarriageSubtype | null>(null);
  const [latestMetrics, setLatestMetrics] = useState<any>(null);
  const [sprints, setSprints] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [integSettings, setIntegSettings] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  async function syncNow() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/bolts/${projectId}/sync-integrations`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "동기화 실패");
      if (!data.synced) {
        toast.warning(data.reason || "연결 설정 필요");
      } else {
        toast.success("Vercel/PostHog 동기화 완료");
        setRefreshKey((k) => k + 1);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function saveIntegrations(patch: Record<string, string>) {
    const supabase = createClient();
    const { error } = await supabase
      .from("project_carriage")
      .update({ integrations: { ...(carriage?.integrations || {}), ...patch } })
      .eq("project_id", projectId);
    if (error) return toast.error(error.message);
    toast.success("연동 설정 저장됨");
    setRefreshKey((k) => k + 1);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const supabase = createClient();

      const [carRes, metricsRes, sprintsRes] = await Promise.all([
        supabase
          .from("project_carriage")
          .select("*")
          .eq("project_id", projectId)
          .maybeSingle(),
        supabase
          .from("bolt_metrics")
          .select("*")
          .eq("project_id", projectId)
          .eq("period_type", "daily")
          .order("period_start", { ascending: false })
          .limit(1),
        supabase
          .from("projects")
          .select("id, title, status")
          .eq("parent_bolt_id", projectId)
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;
      setCarriage((carRes.data as CarriageSubtype) || null);
      setLatestMetrics((metricsRes.data?.[0] as any)?.metrics || null);
      setSprints((sprintsRes.data as any) || []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey]);

  const dau = Number(latestMetrics?.dau || 0);
  const mau = Number(latestMetrics?.mau || 0);
  const uptime = Number(latestMetrics?.uptime_pct || 0);
  const errors = Number(latestMetrics?.errors || 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-nu-ink/5 animate-pulse rounded-[var(--ds-radius-xl)]" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-nu-ink/5 animate-pulse rounded-[var(--ds-radius-lg)]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <header className="border-[2.5px] border-nu-ink bg-gradient-to-br from-nu-blue/10 to-nu-pink/5 rounded-[var(--ds-radius-xl)] p-5">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex items-center justify-center w-11 h-11 bg-nu-blue/20 text-nu-blue rounded-full shrink-0">
            <Globe size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-blue font-bold">
              🌐 Carriage Bolt · 플랫폼형
            </div>
            <h1 className="text-[20px] md:text-[24px] font-head font-extrabold text-nu-ink mt-0.5 leading-tight">
              {title}
            </h1>
            <div className="flex items-center gap-3 flex-wrap mt-2 text-[12px] text-nu-graphite">
              {carriage?.domain && (
                <a
                  href={carriage.domain.startsWith("http") ? carriage.domain : `https://${carriage.domain}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1 text-nu-blue font-semibold hover:underline"
                >
                  <Globe size={11} /> {carriage.domain} <ExternalLink size={9} />
                </a>
              )}
              {carriage?.launched_at && (
                <span className="inline-flex items-center gap-1 font-mono-nu tabular-nums">
                  <Rocket size={11} /> 런칭 {new Date(carriage.launched_at).toLocaleDateString("ko")}
                </span>
              )}
              {carriage?.tech_stack?.length ? (
                <span className="font-mono-nu text-[10px] text-nu-muted">
                  {carriage.tech_stack.join(" · ")}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* Pulse */}
      <section>
        <h3 className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite font-bold mb-2">
          📊 Today's Pulse
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <BoltMetricCard
            icon={<Activity size={11} />}
            label="DAU"
            value={dau.toLocaleString("ko-KR")}
            sub={carriage?.dau_goal ? `목표 ${carriage.dau_goal.toLocaleString("ko-KR")}` : undefined}
            accent="text-nu-blue"
          />
          <BoltMetricCard
            icon={<Activity size={11} />}
            label="MAU"
            value={mau.toLocaleString("ko-KR")}
            sub={carriage?.mau_goal ? `목표 ${carriage.mau_goal.toLocaleString("ko-KR")}` : undefined}
            accent="text-nu-blue"
          />
          <BoltMetricCard
            icon={<Zap size={11} />}
            label="Uptime"
            value={uptime > 0 ? `${uptime.toFixed(1)}%` : "—"}
            sub={errors ? `에러 ${errors}건` : "에러 없음"}
            accent={uptime >= 99.5 ? "text-green-700" : "text-nu-pink"}
          />
          <BoltMetricCard
            icon={<GitCommit size={11} />}
            label="현재 Sprint"
            value={sprints.filter((s) => s.status === "active").length.toString()}
            sub={`전체 ${sprints.length}개`}
            accent="text-nu-ink"
          />
        </div>
        {!latestMetrics && (
          <div className="mt-3 p-3 bg-nu-cream/30 text-[11px] text-nu-graphite rounded border-l-[3px] border-nu-blue/40">
            💡 지표는 <code>bolt_metrics</code> 에 일일 입력으로 쌓이거나, PostHog/Vercel 연동(곧 제공)으로 자동 채워져요.
          </div>
        )}
      </section>

      {/* 연동 상태 */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite font-bold">
            🔌 Integrations
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIntegSettings((v) => !v)}
              className="inline-flex items-center gap-1 text-[10px] font-mono-nu uppercase tracking-widest px-2 py-1 border border-nu-ink/15 rounded hover:bg-nu-ink hover:text-white"
            >
              <Settings size={10} /> 설정
            </button>
            <button
              onClick={syncNow}
              disabled={syncing}
              className="inline-flex items-center gap-1 text-[10px] font-mono-nu uppercase tracking-widest px-2 py-1 border-[1.5px] border-nu-blue bg-nu-blue/10 text-nu-blue rounded hover:bg-nu-blue hover:text-white disabled:opacity-50"
            >
              {syncing ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
              지금 동기화
            </button>
          </div>
        </div>

        {integSettings && (
          <div className="mb-2 p-3 border border-nu-ink/10 rounded bg-nu-cream/20 space-y-2">
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite font-bold">
              프로젝트 ID 연결
            </div>
            <IntegrationField
              label="Vercel Project ID"
              placeholder="prj_xxx..."
              value={carriage?.integrations?.vercel_project_id || ""}
              onSave={(v) => saveIntegrations({ vercel_project_id: v })}
            />
            <IntegrationField
              label="PostHog Project ID"
              placeholder="12345"
              value={carriage?.integrations?.posthog_project_id || ""}
              onSave={(v) => saveIntegrations({ posthog_project_id: v })}
            />
            <p className="text-[10px] text-nu-muted leading-[1.5]">
              환경 변수 필요: <code>VERCEL_API_TOKEN</code>, <code>POSTHOG_API_KEY</code>{" "}
              (서버에만 노출).
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(
            [
              { name: "Vercel", key: "vercel_project_id" },
              { name: "PostHog", key: "posthog_project_id" },
              { name: "Sentry", key: "sentry_dsn" },
              { name: "Stripe", key: "stripe_account" },
            ] as const
          ).map((p) => {
            const connected = !!carriage?.integrations?.[p.key];
            return (
              <div
                key={p.name}
                className={`p-3 rounded border-[1.5px] text-center ${
                  connected
                    ? "border-green-400 bg-green-50"
                    : "border-dashed border-nu-ink/15 bg-white opacity-60"
                }`}
              >
                <div className="font-mono-nu text-[11px] font-bold">{p.name}</div>
                <div
                  className={`font-mono-nu text-[9px] uppercase tracking-widest mt-0.5 ${
                    connected ? "text-green-700" : "text-nu-muted"
                  }`}
                >
                  {connected ? "연결됨" : "미연결"}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 중첩 Sprint (자식 Hex) */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite font-bold">
            🏗 Sprints (중첩 Hex Bolt)
          </h3>
          <Link
            href={`/projects/create?parent=${projectId}`}
            className="text-[11px] font-mono-nu uppercase tracking-widest text-nu-pink font-bold inline-flex items-center gap-1 hover:underline"
          >
            <Plus size={11} /> Sprint 추가
          </Link>
        </div>
        {sprints.length === 0 ? (
          <div className="p-4 bg-nu-cream/30 text-[11px] text-nu-graphite rounded border-l-[3px] border-nu-blue/40">
            아직 이 플랫폼 안에 중첩된 Sprint(Hex 볼트)가 없어요. 릴리스 단위로 Sprint 를 만들면 진도 추적이 쉬워져요.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {sprints.map((s) => (
              <Link
                key={s.id}
                href={`/projects/${s.id}`}
                className="block p-3 border border-nu-ink/[0.08] hover:border-nu-pink bg-white rounded-[var(--ds-radius-md)] no-underline"
              >
                <div className="font-semibold text-nu-ink text-[13px]">{s.title}</div>
                <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mt-0.5">
                  {s.status}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function IntegrationField({
  label,
  value,
  onSave,
  placeholder,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div className="flex items-center gap-2">
      <label className="w-40 text-[10px] font-mono-nu uppercase tracking-widest text-nu-graphite shrink-0">
        {label}
      </label>
      <input
        type="text"
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-2 py-1 border border-nu-ink/15 rounded text-[11px] font-mono-nu"
      />
      <button
        onClick={() => onSave(v)}
        className="text-[10px] font-mono-nu uppercase tracking-widest px-2 py-1 border border-nu-ink/15 rounded hover:bg-nu-ink hover:text-white"
      >
        저장
      </button>
    </div>
  );
}
