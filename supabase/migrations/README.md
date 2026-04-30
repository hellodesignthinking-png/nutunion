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

---

# 126 / 127 — Performance & RLS Audit (2026-04)

두 마이그레이션 모두 **additive + idempotent**. Supabase SQL Editor 에서 순서 무관하게 실행 가능.

## 126_perf_indexes.sql — 누락 인덱스 보강

자주 쓰이는 쿼리 패턴에 맞춰 인덱스 추가. 기존 인덱스와 중복되는 항목은 작성하지 않음.

| 테이블 | 인덱스 | 이유 |
|---|---|---|
| `chat_thread_reads` | `(parent_message_id)` | 부모 메시지별 읽음 fan-out 조회 |
| `notifications` | `(user_id, created_at desc) where is_read=false` | digest 크론의 미읽음 + 시간순 조회 |
| `task_issue_links` | `(provider, external_id)` | GitHub/Linear 웹훅 역조회 |
| `task_issue_links` | `(linked_by)` | RLS 평가 가속 |
| `thread_data` | `(created_by)` | RLS update/delete 가속 |
| `thread_installations` | `(installed_by)` | "내가 설치한" 목록 + RLS |
| `daily_briefings` | `(user_id, briefing_date desc)` | 모닝 브리핑 upsert/조회 |
| `automation_logs` | `(executed_at desc) where status='failed'` | 실패 알림 패널 |
| `automation_approvals` | `(log_id)` | 승인 처리 시 로그 역조회 |
| `yjs_documents` | `(updated_by) where not null` | RLS 가속 |
| `file_comments` | `(user_id)` | RLS + "내 코멘트" |
| `person_context_notes` | `(person_id, created_at desc)` | 인물 타임라인 |

## 127_rls_hardening.sql — 정책 약점 수정

| 테이블 | 문제 | 수정 |
|---|---|---|
| `task_issue_links` | `select using(true)` — 모든 외부 이슈 링크가 사용자에게 노출 | 링커 본인 + 부모 task 의 멤버만 select |
| `task_issue_links` | UPDATE 정책 부재로 동기화 실패 | `for update` 정책 추가 (linked_by 기준) |
| `yjs_documents` | `for all using (updated_by=auth.uid())` — INSERT 시 doc_id 소유 검증 누락 | INSERT/UPDATE/DELETE 분리, doc_id → personal_notes.user_id 검사 |
| `file_comments` | `select using(true)` — 모든 PDF 코멘트 노출 | 코멘트 본인 + 부모 파일 RLS 통과만 select |
| `file_comments` | UPDATE 정책 부재 | 본인 코멘트 수정 정책 추가 |
| `thread_reviews` | UPDATE 에 WITH CHECK 누락 → user_id 변조 가능 | WITH CHECK 추가 |
| `thread_installations` | UPDATE 에 WITH CHECK 누락 | WITH CHECK 추가 |
| `thread_data` | UPDATE 에 WITH CHECK 누락 | WITH CHECK 추가 |
| `automation_logs` / `member_resource_access` | service-role 전용 쓰기 — 정책 없음 정상 | 의도 주석으로 명시 |

## 검증

```sql
-- 신규 인덱스 존재 확인
select indexname from pg_indexes
where indexname in (
  'idx_chat_thread_reads_parent','idx_notifications_user_unread_created',
  'idx_task_issue_links_external','idx_thread_data_created_by',
  'idx_daily_briefings_user_date','idx_yjs_documents_updated_by'
);

-- 정책 변경 확인 (using = true 가 남아있지 않아야 함)
select schemaname, tablename, policyname, qual
from pg_policies
where tablename in ('task_issue_links','file_comments','yjs_documents')
  and cmd = 'SELECT';
```

## 롤백

```sql
-- 인덱스: drop index if exists idx_<name>;
-- 정책: 이전 버전 정책으로 drop+create. 참고는 마이그레이션 119/120/124/108/115 원본.
```
