# 업타임 모니터 설정 가이드

## 엔드포인트

프로덕션: `https://nutunion.co.kr/api/health`

### 응답 스펙

| 상태 | 반환 | 조건 |
|---|---|---|
| `healthy` | HTTP 200 | DB 연결 + 환경변수 모두 OK |
| `degraded` | HTTP 503 | 최소 1개 체크 실패 |

응답 바디:
```json
{
  "status": "healthy",
  "timestamp": "2026-04-18T08:00:00.000Z",
  "duration_ms": 45,
  "checks": {
    "database": { "ok": true, "duration_ms": 32 },
    "env": { "ok": true }
  }
}
```

## 추천 서비스 설정

### 1. UptimeRobot (무료 플랜 — 5분 간격, 50 모니터까지 무료)

1. [uptimerobot.com](https://uptimerobot.com) 가입
2. Dashboard → `+ Add New Monitor`
3. 설정:
   - **Monitor Type**: HTTPS
   - **Friendly Name**: `nutunion health`
   - **URL**: `https://nutunion.co.kr/api/health`
   - **Monitoring Interval**: 5 minutes (무료 최소값)
   - **Keyword Monitoring** (선택): Alert if keyword `healthy` **NOT exists** → 503 뿐 아니라 응답 body 까지 체크
4. Alert Contacts: 이메일 / Slack / Telegram 등록

### 2. BetterStack (구 BetterUptime, 무료 플랜 — 3분 간격, 10 모니터)

1. [betterstack.com/better-uptime](https://betterstack.com/better-uptime)
2. `Create monitor` → HTTP(S)
3. URL: `https://nutunion.co.kr/api/health`
4. Check interval: 3 minutes
5. Incident escalation → 즉시 알림 + 5분 후 전화 등

### 3. Vercel 자체 모니터링 (간단)

Vercel Dashboard → Project → **Observability** → Monitoring
- 자동으로 5xx 응답을 감지
- `Logs` 탭에서 `/api/health` 필터링 → 최근 503 확인

## 알림 규칙 권장

| 트리거 | 액션 |
|---|---|
| HTTP 503 연속 2회 | 이메일 알림 |
| HTTP 503 연속 5회 (15분) | SMS / 전화 |
| Response time > 5초 | 경고 |
| DNS / SSL 만료 30일 전 | 경고 |

## 장애 대응 플레이북

응답이 503 으로 바뀌면 `checks` 필드 확인:

| 실패 체크 | 가능한 원인 | 대응 |
|---|---|---|
| `database.ok: false` | Supabase 다운, 연결 한도 초과, DNS 문제 | Supabase 상태 페이지 확인, 재배포, 연결 풀 설정 |
| `env.ok: false` | 환경변수 미설정 | Vercel Dashboard → Environment Variables 확인 |
| duration_ms > 3000 | DB 응답 지연 | Supabase 대시보드 → Reports → Query Performance |

## 노트

- `/api/health` 는 **공개** 엔드포인트 (인증 불필요) — 외부 모니터가 접근 가능하도록
- 민감 정보 비노출: DB 연결 문자열, env 값 자체는 응답에 없음
- `Cache-Control: no-store` — CDN 캐싱 방지
