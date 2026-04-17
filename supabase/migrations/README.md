# Finance 보안 마이그레이션 (040~044)

## 실행 순서 (Supabase SQL Editor 에서 순서대로)

각 파일은 **멱등** (여러 번 실행해도 안전). 실패 시 해당 파일만 재실행.

| # | 파일 | 설명 | 의존성 |
|---|---|---|---|
| 1 | `040_finance_rls_policies.sql` | 12개 테이블 RLS + 헬퍼 함수 2개 | 없음 |
| 2 | `040b_finance_rls_fix_cast.sql` | 040 의 타입 캐스트 수정 패치 | 040 이 일부라도 실행된 상태 권장 |
| 3 | `041_finance_audit_logs.sql` | `finance_audit_logs` 테이블 | 없음 (inline admin 체크) |
| 4 | `042_rate_limits.sql` | `rate_limits` 테이블 + `check_rate_limit()` RPC | 없음 |
| 5 | `043_ai_usage_logs.sql` | `ai_usage_logs` 테이블 | 없음 (inline admin 체크) |
| 6 | `044_approvals_requester_id_fix.sql` | `approvals.requester_id` 컬럼 보장 | 040b 이후 권장 |

## 필요한 환경변수 (Vercel Dashboard → Settings → Environment Variables)

| 변수명 | 용도 | 설정 방법 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | 이미 설정되어 있을 것 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | 이미 설정되어 있을 것 |
| `SUPABASE_SERVICE_ROLE_KEY` | RLS 우회 (admin routes + cron) | Supabase Dashboard → Settings → API |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway | 이미 설정되어 있을 것 |
| `CRON_SECRET` | 크론 요청 인증 | `openssl rand -base64 32` → Vercel env 에 저장 |

## 검증 쿼리

### RLS 활성화 확인
```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'transactions','employees','companies','attendances','payroll',
    'approvals','profiles','projects','project_members','project_milestones',
    'finance_audit_logs','rate_limits','ai_usage_logs'
  )
order by tablename;
```

→ 모두 `rowsecurity = true` 여야 함.

### Finance 정책 목록
```sql
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and policyname like 'finance_%' or policyname like 'ai_usage_%'
order by tablename, policyname;
```

### 헬퍼 함수 존재 확인
```sql
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'is_finance_admin_staff', 'current_employee_id', 'check_rate_limit'
  );
```

### 감사 로그 동작 확인
admin 계정으로 거래 1건 추가한 뒤:
```sql
select action, summary, actor_email, created_at
from public.finance_audit_logs
order by created_at desc
limit 5;
```

### Rate limit 동작 확인
```sql
select key, count, window_start from public.rate_limits
order by updated_at desc limit 10;
```

### AI 사용량 확인
```sql
select actor_email, endpoint, model, input_tokens, output_tokens, success, created_at
from public.ai_usage_logs
order by created_at desc
limit 10;
```

## 크론 동작 확인

```bash
# 로컬에서 수동 테스트 (CRON_SECRET 은 Vercel env 값과 동일하게)
curl -H "Authorization: Bearer ${CRON_SECRET}" \
  https://nutunion.co.kr/api/cron/cleanup-audit-logs
```

응답 예시:
```json
{
  "success": true,
  "duration_ms": 42,
  "total_deleted": 0,
  "results": {
    "finance_audit_logs": { "deleted": 0 },
    "ai_usage_logs": { "deleted": 0 },
    "rate_limits": { "deleted": 0 }
  }
}
```

Vercel 이 자동 실행한 로그는 Dashboard → Project → Cron Jobs 에서 확인.

## 롤백

각 마이그레이션 파일 하단의 "롤백" 섹션 참고.
