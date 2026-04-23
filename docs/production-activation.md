# Production Activation Checklist

외부 서비스·DB 자동화 4건의 **실제 활성화** 순서. 코드는 전부 준비됨 — 키 주입 + DB 설정만 남음.

---

## 1. Vercel AI Gateway 연결 (권장 경로)

### 왜 Gateway?
- **OIDC 자동 인증** — `VERCEL_OIDC_TOKEN` 자동 주입, manual key rotation 불필요
- **failover / 비용 가시성** — Vercel dashboard 에서 실시간
- 코드: `anthropic/claude-sonnet-4.5` slug 그대로 동작

### 활성화 순서
```
1. https://vercel.com/{team}/{project}/ai-gateway 접속
2. "Connect" → Anthropic / OpenAI 등 프로바이더 선택
3. Model slug 확인 → 코드 `MODEL = "anthropic/claude-sonnet-4.5"` (lib/ai/client.ts) 와 일치
4. 다음 배포 시 VERCEL_OIDC_TOKEN 자동 주입 → 즉시 동작
```

### 로컬 개발
```bash
vercel env pull .env.local --yes   # VERCEL_OIDC_TOKEN 12h 유효
# 만료 시 재실행
```

### 대안 — API Key 직접
```
AI_GATEWAY_API_KEY=xxx   # Gateway 콘솔에서 발급 (OIDC 없을 때)
```

### 검증
```bash
curl -X POST https://nutunion.co.kr/api/ai/nut-description \
  -H "Content-Type: application/json" \
  -H "cookie: $ADMIN_SESSION" \
  -d '{"name":"테스트 너트","category":"culture","keywords":[]}'
```

---

## 2. Resend / NCP SENS / Popbill 키 주입

### Resend (이메일 · 알림 Digest)
```
1. https://resend.com 가입 → Domain 인증 (nutunion.co.kr DNS TXT 추가)
2. API Key 발급 → Vercel env:
   RESEND_API_KEY=re_xxx
   RESEND_FROM="nutunion <noreply@nutunion.co.kr>"
3. 배포 후 /notifications 에서 테스트 계정에 알림 생성 →
   cron 발송: curl -H "Authorization: Bearer $CRON_SECRET" \
     https://nutunion.co.kr/api/cron/notifications-digest
```

### NCP SENS (카카오 알림톡)
```
1. https://console.ncloud.com → Simple & Easy Notification Service
2. 카카오 비즈 채널 연동 (@nutunion 가정)
3. 5개 템플릿 사전 승인:
   - REVIEW_REQUEST_V1
   - APP_APPROVED_V1
   - APP_REJECTED_V1
   - MILESTONE_DUE_V1
   - WEEKLY_MATCH_V1
   (템플릿 문안: lib/alimtalk/send.ts 의 ALIMTALK_TEMPLATES 와 동일)
4. Vercel env:
   NCP_SENS_SERVICE_ID=ncp:sms:kr:...
   NCP_SENS_ACCESS_KEY=...
   NCP_SENS_SECRET_KEY=...
   NCP_SENS_KAKAO_CHANNEL_ID=@nutunion
   NCP_SENS_SENDER_PHONE=01012345678
```

### Popbill (세금계산서)
```
1. https://www.popbill.com 가입 → 사업자 인증
2. 개발 / 운영 분리:
   POPBILL_MODE=TEST        # → PRODUCTION 은 실 세금계산서 발행
   POPBILL_LINK_ID=...
   POPBILL_SECRET_KEY=...
   POPBILL_CORP_NUM=1234567890   # nutunion 사업자번호 (숫자만)
   POPBILL_USER_ID=ADMIN
3. TEST 모드에서 1건 발행 → 국세청 승인번호 받는지 확인
4. 법무 검토 후 PRODUCTION 전환
```

### 상태 확인
```
/admin/integrations — 모든 키 설정 상태 한눈에
/api/health/integrations — JSON
```

---

## 3. pg_cron 활성화 (Supabase)

### 스텝
```
1. Supabase Dashboard → Database → Extensions
2. "pg_cron" 검색 → Enable
3. SQL Editor 에서 Migration 080 실행:
   supabase/migrations/080_pg_cron_daily_metrics.sql
4. 확인:
   select * from cron.job where jobname = 'nutunion_daily_metrics';
5. 수동 테스트 (최근 7일 일괄 재계산):
   select public.recompute_daily_metrics_range(current_date - 7);
```

### 스케줄
- `5 0 * * *` UTC = 09:05 KST
- 전날(00:00~23:59) 지표를 `daily_metrics` 에 upsert

### 검증
```
/admin/overview — DAU / WAU / MAU 수치 정확 표시
/api/admin/metrics — raw JSON, daily array 조회
```

---

## 4. 강성(Stiffness) Triggers 활성화

### 스텝
```
1. Supabase SQL Editor → Migration 081 실행:
   supabase/migrations/081_stiffness_triggers.sql
```

### 자동 기록되는 이벤트
| 트리거 | 포인트 | 조건 |
|---|---:|---|
| 마일스톤 완료 | +10 | status → completed |
| 볼트 마감 | +25 | closure_summary 제출 |
| 너트 합류 | +5 | group_members.status → active |
| 미팅 체크인 | +3 | event_checkins insert |
| 크루 포스트 작성 | +2 | crew_posts insert |
| 탭 편집 (100자+) | +3 | bolt_taps.content_md 변경 |
| 리뷰 받음 | +5 | project_reviews insert (target) |

### 검증
```
1. 테스트 계정으로 마일스톤 완료 → stiffness_breakdown 뷰 조회:
   select * from stiffness_breakdown where user_id = 'xxx';
   → activity_score +10, events_this_week +1
2. /portfolio/[id] → Stiffness 위젯에 "이번 주 +10" 배지 표시
3. 관리자 대시보드에서 Top 강성 와셔 정렬 변동 확인
```

---

## 🚀 런칭 체크리스트 (전체)

### 환경변수
- [ ] `.env.example` 전 항목 Vercel Dashboard 에 등록 (Production 스코프)
- [ ] `vercel env pull .env.local --yes` 로 로컬 동기화
- [ ] `AI_GATEWAY_API_KEY` OR Vercel AI Gateway 연결
- [ ] `RESEND_API_KEY` + `RESEND_FROM` + 도메인 인증
- [ ] `NCP_SENS_*` 5종 + 5개 템플릿 비즈 센터 승인
- [ ] `POPBILL_*` 5종 + TEST 발행 1건 검증
- [ ] `TOSS_SECRET_KEY` + `NEXT_PUBLIC_TOSS_CLIENT_KEY` (test → live)
- [ ] `OAUTH_STATE_SECRET` 32-byte base64
- [ ] `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`
- [ ] `CRON_SECRET` 설정 + Vercel Cron 자동 인증 확인

### DB Migrations
- [ ] 067 ~ 081 전부 순서대로 실행
- [ ] `pg_cron` 확장 활성화
- [ ] `vector` 확장 활성화 (pgvector)
- [ ] 스케줄된 cron job 확인

### 도메인
- [ ] apex/www 리다이렉트 검증: `curl -I https://www.nutunion.co.kr`
- [ ] SSL 인증서 자동 갱신 상태 정상
- [ ] `sitemap.xml` · `robots.txt` 배포

### 법무·결제
- [ ] 이용약관 / 개인정보처리방침 / 마케팅 동의 / 커뮤니티 규칙 4종 배포
- [ ] Popbill PRODUCTION 전환 **법무 검토 후**
- [ ] Toss live key 전환 **소액 E2E 통과 후**
- [ ] 세무사 검토 (원천징수영수증 템플릿)

### 관리자
- [ ] `/admin/integrations` 모든 서비스 ✓
- [ ] `/admin/overview` 수치 정상
- [ ] `/admin/analytics` 퍼널 렌더
- [ ] 일 1회 9am digest 이메일 수신 확인 (Taina 본인)

### 보안
- [ ] Supabase RLS 정책 전수 검토
- [ ] Vercel env 민감 변수 `--sensitive` 플래그
- [ ] OAuth redirect URI 각 공급자 앱 설정 일치
- [ ] `admin.role` 권한 전수 점검 (최소 2명 admin)
