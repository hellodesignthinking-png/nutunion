/**
 * Carriage 연동 — Vercel / PostHog 데이터 fetch.
 *
 * 설계:
 *  - 각 provider 는 단순 함수 (provider config → daily metrics object)
 *  - 서버 전용 (토큰 노출 금지)
 *  - 실패는 null 반환 (소프트 실패, 대시보드는 "연결 안 됨" 표시)
 *
 * 환경 변수:
 *  - VERCEL_API_TOKEN        : Vercel Access Token
 *  - VERCEL_TEAM_ID          : (선택) Team ID
 *  - POSTHOG_API_KEY         : PostHog Personal API Key
 *  - POSTHOG_HOST            : https://us.i.posthog.com (default) 또는 eu
 */

export interface VercelDailySnapshot {
  errors: number;
  uptime_pct: number;
  releases: number;           // 오늘 생성된 deployment 개수
  avg_response_ms?: number;
}

export interface PostHogDailySnapshot {
  dau: number;
  mau: number;
  pageviews: number;
  new_users?: number;
}

export interface IntegrationsConfig {
  vercel_project_id?: string;
  posthog_project_id?: string;
  [key: string]: string | undefined;
}

/**
 * Vercel 프로젝트의 지난 24시간 배포 + 에러 개수 집계.
 * API: /v6/deployments?projectId=...&since=...
 */
export async function fetchVercel(cfg: IntegrationsConfig): Promise<VercelDailySnapshot | null> {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token || !cfg.vercel_project_id) return null;

  const since = Date.now() - 24 * 60 * 60 * 1000;
  const teamParam = process.env.VERCEL_TEAM_ID ? `&teamId=${process.env.VERCEL_TEAM_ID}` : "";
  const url = `https://api.vercel.com/v6/deployments?projectId=${cfg.vercel_project_id}&since=${since}&limit=50${teamParam}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const deployments = data?.deployments || [];
    const errors = deployments.filter((d: any) => d.state === "ERROR").length;
    const ready = deployments.filter((d: any) => d.state === "READY").length;
    const total = Math.max(1, deployments.length);
    return {
      errors,
      uptime_pct: total > 0 ? (ready / total) * 100 : 100,
      releases: ready,
    };
  } catch (err) {
    console.error("[vercel fetch]", err);
    return null;
  }
}

/**
 * PostHog 프로젝트의 지난 24시간 DAU + MAU.
 * 간단 쿼리: insights API 대신 events 엔드포인트 카디널리티 집계 — 복잡하므로 /api/projects/{id}/insights/trend 사용 권장.
 *
 * 실제 구현은 PostHog 사용 정책에 따라 다양. 여기는 "events 집계" 가벼운 버전.
 */
export async function fetchPostHog(cfg: IntegrationsConfig): Promise<PostHogDailySnapshot | null> {
  const key = process.env.POSTHOG_API_KEY;
  if (!key || !cfg.posthog_project_id) return null;

  const host = process.env.POSTHOG_HOST || "https://us.i.posthog.com";
  const today = new Date();
  const yday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const dauQuery = {
    query: {
      kind: "HogQLQuery",
      query: `SELECT count(distinct distinct_id) AS dau FROM events WHERE event = '$pageview' AND timestamp >= '${yday.toISOString()}' AND timestamp < '${today.toISOString()}'`,
    },
  };
  const mauQuery = {
    query: {
      kind: "HogQLQuery",
      query: `SELECT count(distinct distinct_id) AS mau FROM events WHERE event = '$pageview' AND timestamp >= '${monthAgo.toISOString()}' AND timestamp < '${today.toISOString()}'`,
    },
  };

  try {
    const headers = {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    };
    const projectUrl = `${host}/api/projects/${cfg.posthog_project_id}/query`;
    const [dauRes, mauRes] = await Promise.all([
      fetch(projectUrl, { method: "POST", headers, body: JSON.stringify(dauQuery) }),
      fetch(projectUrl, { method: "POST", headers, body: JSON.stringify(mauQuery) }),
    ]);
    const dauData = dauRes.ok ? await dauRes.json() : { results: [[0]] };
    const mauData = mauRes.ok ? await mauRes.json() : { results: [[0]] };
    return {
      dau: Number(dauData?.results?.[0]?.[0] || 0),
      mau: Number(mauData?.results?.[0]?.[0] || 0),
      pageviews: 0,
    };
  } catch (err) {
    console.error("[posthog fetch]", err);
    return null;
  }
}

/**
 * 통합 sync — Carriage 볼트 1건에 대해 오늘의 스냅샷을 모음.
 * bolt_metrics 에 daily upsert 하기 직전까지의 단계.
 */
export async function syncCarriageDaily(cfg: IntegrationsConfig): Promise<{
  vercel: VercelDailySnapshot | null;
  posthog: PostHogDailySnapshot | null;
  metrics: Record<string, number>;
}> {
  const [vercel, posthog] = await Promise.all([fetchVercel(cfg), fetchPostHog(cfg)]);

  const metrics: Record<string, number> = {};
  if (vercel) {
    metrics.errors = vercel.errors;
    metrics.uptime_pct = vercel.uptime_pct;
    metrics.releases = vercel.releases;
  }
  if (posthog) {
    metrics.dau = posthog.dau;
    metrics.mau = posthog.mau;
    metrics.pageviews = posthog.pageviews;
  }

  return { vercel, posthog, metrics };
}
