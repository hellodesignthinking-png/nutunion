# Sentry 통합 가이드

> 코드베이스에 이미 자체 logger(`lib/observability/logger.ts`)가 있고, 100+ 라우트가
> withRouteLog 로 표준화돼 있다. Sentry 는 그 위에 외부 sink 로 얹는다.

## 설치 (5분)

```bash
pnpm add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Wizard 가 다음을 자동 생성:
- `sentry.client.config.ts` / `sentry.server.config.ts` / `sentry.edge.config.ts`
- `next.config.ts` 에 `withSentryConfig` wrap
- `.env` 에 `SENTRY_DSN` 추가 안내

## 자체 logger 와 통합

`sentry.server.config.ts` 끝에 sink 등록:

```ts
import * as Sentry from "@sentry/nextjs";
import { setLogSink } from "@/lib/observability/logger";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  // ...
});

// 우리 logger.error → Sentry exception 으로 자동 전송
setLogSink({
  onError: (rec) => {
    const err = rec.error as { message?: string; stack?: string } | undefined;
    if (err?.stack) {
      Sentry.captureException(err);
    } else {
      Sentry.captureMessage(rec.event, {
        level: "error",
        extra: rec as Record<string, unknown>,
      });
    }
  },
  onWarn: (rec) => {
    Sentry.captureMessage(rec.event, {
      level: "warning",
      extra: rec as Record<string, unknown>,
    });
  },
});
```

이 한 줄로 250 라우트의 모든 `log.error()` 가 Sentry 로 자동 전송된다.

## 환경변수

| Key | 용도 | 필수 |
|---|---|---|
| `SENTRY_DSN` | 프로젝트 DSN | ✓ |
| `SENTRY_AUTH_TOKEN` | 빌드시 sourcemap 업로드 | 권장 |
| `SENTRY_ORG`, `SENTRY_PROJECT` | sourcemap 대상 | 권장 |

## Hobby vs Pro

- Sentry Free: 5K events/month — nutunion 정도 규모면 충분
- 트래픽 늘면 sample rate 조정: `tracesSampleRate: 0.05`

## 대안 (Sentry 없이)

`/admin/metrics` 페이지에 `automation_logs` + `ai_usage_logs` 시각화 — 이미 구현됨.
긴급 알람만 필요하면 `ALERT_WEBHOOK_URL` (Slack/Discord) 로 health-watch cron 이 발송.
