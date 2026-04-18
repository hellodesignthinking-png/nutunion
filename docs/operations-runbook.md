# nutunion Finance 운영 런북

> 프로덕션 운영 표준 절차 (SOP). 장애 대응, 일상 유지, 주요 변경 시 이 문서부터 확인.

## 1. 주요 대시보드 링크

| 이름 | URL | 용도 |
|---|---|---|
| 프로덕션 | https://nutunion.co.kr | 본 서비스 |
| 운영 상태 | https://nutunion.co.kr/finance/status | DB / 테이블 / 감사 / 크론 건강도 (admin) |
| 감사 로그 | https://nutunion.co.kr/finance/audit | 변경 이력 (admin) |
| AI 비용 | https://nutunion.co.kr/finance/cost | 토큰 / 비용 추정 (staff+) |
| Health | https://nutunion.co.kr/api/health | 업타임 모니터용 |
| Vercel | https://vercel.com/hellodesignthinking-9738s-projects/nutunion | 배포 / 로그 / env |
| Supabase | https://supabase.com/dashboard/project/htmrdefcbslgwttjayxt | DB / SQL / Storage / Auth |

## 2. 환경변수 (Vercel Production)

| Key | 필수 | 용도 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 엔드포인트 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | 클라이언트 DB 접근 (RLS 경유) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | 관리 라우트 + 크론 (RLS 우회) |
| `AI_GATEWAY_API_KEY` | ✅ | AI 마케팅 생성 |
| `CRON_SECRET` | ✅ | Vercel Cron 호출 인증 |

**회전 주기 권장**: `CRON_SECRET` · `SUPABASE_SERVICE_ROLE_KEY` → 분기별.

## 3. 크론 잡

| 경로 | 스케줄 | 대상 |
|---|---|---|
| `/api/cron/cleanup-audit-logs` | `17 3 * * *` (매일 UTC 03:17) | audit 90일+ / ai_usage 180일+ / rate_limits 1일+ |

**수동 호출**:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://nutunion.co.kr/api/cron/cleanup-audit-logs
```

**Vercel 로그 확인**: Dashboard → Project → Cron Jobs 탭.

## 4. 배포 절차

### 자동 배포 (기본)

`main` 브랜치에 push → Vercel GitHub 통합이 자동 빌드 + 배포.

### 수동 배포 (통합 장애 시)

```bash
cd /Users/TaiNa0/Desktop/nutunion
npx vercel@latest --prod --yes
```

### 롤백

Vercel Dashboard → Deployments → 이전 배포 **⋯** → **Promote to Production**.

### CI 체크

모든 PR 및 main push → GitHub Actions `CI` 워크플로가 typecheck + build 검증.
실패 시 Vercel 배포도 중단됨.

## 5. DB 마이그레이션 절차

### 신규 마이그레이션 추가

1. `supabase/migrations/NNN_<name>.sql` 파일 작성
2. 로컬에서 문법 검증
3. Git commit + push
4. **Supabase SQL Editor** 에서 수동 실행 (자동화 안 됨)

### 실행 순서 (프로덕션 현재 상태)

| # | 파일 | 비고 |
|---|---|---|
| 040, 040b, 041 | Finance RLS + 감사 로그 | ✓ 적용 |
| 042, 043 | Rate limit + AI 사용량 | ✓ 적용 |
| 044 | approvals.requester_id 보정 | ✓ 적용 |
| 050, 051 | 데이터 무결성 + 인덱스 | ✓ 적용 |
| 052b | FK 제약 (dollar quote 우회) | ✓ 적용 |
| 053 | Storage 버킷 | ✓ 적용 |

## 6. 장애 대응 플레이북

### 6.1 `/api/health` 503 — DB 연결 실패

1. Supabase 상태: https://status.supabase.com
2. 현재 연결 수: Supabase Dashboard → Reports → API
3. 최근 롱 쿼리: Reports → Query Performance
4. 즉시 조치: Vercel 재배포 (connection pool reset)

### 6.2 수상한 거래/변경

1. `/finance/audit` → 엔터티 필터로 의심 레코드 조회
2. 해당 `actor_email` + `created_at` 확인
3. RLS 우회 시도인지 — Supabase Logs → API → `anon_key` 직접 호출 체크

### 6.3 Rate Limit 과다 발생

1. `/finance/status` → "활성 rate limit 키" 수치
2. 10,000 초과 시 → 특정 사용자 남용 의심
3. SQL 직접 조회:
   ```sql
   select key, count, window_start
   from public.rate_limits
   order by count desc limit 20;
   ```
4. 필요 시 수동 정리: `delete from public.rate_limits where updated_at < now() - interval '1 hour';`

### 6.4 AI 비용 급증

1. `/finance/cost` → 30일 뷰 → 사용자별 순위
2. 한 사용자가 비정상 소비 → marketing rate limit 정책 재검토 (`5/min + 30/hour`)
3. 비상: 해당 사용자 `role` 을 임시로 `member` 로 낮춰 `/api/finance/marketing` 접근 차단

### 6.5 Storage 업로드 실패

1. Supabase Dashboard → Storage → 버킷 `finance-receipts` / `finance-signatures` 용량 확인
2. RLS 정책: `finance_storage_*` 정책 유무 (053 마이그레이션)
3. 용량 한도: 2MB (receipts), 1MB (signatures) — 053 파일 참조

### 6.6 크론이 안 돌 때

1. Vercel Dashboard → Cron Jobs 탭 → 최근 실행 이력
2. 500 / 401 실패 시:
   - 401 → `CRON_SECRET` 환경변수 확인
   - 500 → `SUPABASE_SERVICE_ROLE_KEY` 확인
3. 수동 호출로 재생성:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://nutunion.co.kr/api/cron/cleanup-audit-logs
   ```

## 7. 보안 이벤트 대응

### 의심 로그인 / RLS 우회

1. Supabase Dashboard → Authentication → Users → 최근 로그인 확인
2. Logs → Auth 에서 이상 징후 탐색
3. 비상 시: 해당 사용자 `role` 을 `member` 로 다운그레이드 (RLS 가 자동 차단)

### 비밀키 유출 의심

```bash
# CRON_SECRET 교체
npx vercel env rm CRON_SECRET production --yes
printf "$(openssl rand -base64 32 | tr -d '\n')" | npx vercel env add CRON_SECRET production --yes
npx vercel --prod --yes
```

SERVICE_ROLE_KEY 교체 필요 시:
1. Supabase Dashboard → Settings → API → `service_role` Regenerate
2. Vercel env 에 새 값 업데이트
3. 재배포

## 8. 데이터 보관 정책

| 데이터 | 보관 기간 | 삭제 주체 |
|---|---|---|
| `finance_audit_logs` | 90일 | 크론 (cleanup-audit-logs) |
| `ai_usage_logs` | 180일 | 크론 |
| `rate_limits` | 1일 | 크론 |
| `transactions` / `employees` / 등 | 영구 (소프트 삭제만) | 수동 |

소프트 삭제 기준:
- `employees.status = '퇴직'` — 레코드 유지, end_date 세팅
- `transactions` — 직접 삭제 (감사 로그에 before 스냅샷 보존)

## 9. 성능 모니터링

### Vercel Speed Insights
Dashboard → Project → Speed Insights 탭 — Core Web Vitals (LCP/INP/CLS) 자동 수집.

### Supabase Query Performance
Dashboard → Reports → Query Performance — 느린 쿼리 식별.

### 업타임 (외부)
UptimeRobot 등 — 5분 간격 `/api/health` 호출. `docs/uptime-monitoring.md` 참고.

## 10. 주요 연락처 / 에스컬레이션

- Supabase 지원: https://supabase.com/support
- Vercel 지원: https://vercel.com/help
- 내부: (팀 연락 채널)

---

**갱신 주기**: 큰 변경 시 이 문서 업데이트.
**최종 검토**: 분기별로 각 섹션 유효성 확인.
