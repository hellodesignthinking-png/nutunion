# Cloudflare R2 설정 가이드

nutunion 의 **하이브리드 스토리지 모델** — R2 우선, Supabase Storage fallback, Google Drive 대용량 연동.

## 1. Cloudflare 에서 버킷 생성

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → R2 → **Create bucket**
2. 버킷 이름: `nutunion-media` (또는 원하는 이름)
3. Location: **Automatic** (한국 유저 중심이면 ENAM/APAC 자동 선택됨)

## 2. Public Access 설정 (두 가지 중 택1)

### A. 빠른 시작 — R2.dev 퍼블릭 URL

- 버킷 → Settings → **Public Access → Allow Access**
- 제공되는 `https://pub-{accountId}.r2.dev/{key}` 바로 사용 가능
- 단점: Cloudflare 요청 제한 있음

### B. 커스텀 도메인 (권장)

- 버킷 → Settings → **Custom Domains → Connect Domain**
- `cdn.nutunion.co.kr` 같은 서브도메인 연결
- DNS 설정 자동, SSL 자동
- 장점: 전송 무제한 + 브랜드화 + 프리뷰 시에도 캐싱 활용

## 3. API Token 발급

1. R2 → **Manage R2 API Tokens → Create API Token**
2. Permissions: **Object Read & Write**
3. Specify bucket: 방금 만든 버킷만 선택 (권한 최소화)
4. 발급된 **Access Key ID** 와 **Secret Access Key** 저장

## 4. Vercel 환경변수 등록

Vercel Dashboard → Settings → Environment Variables 에 추가:

| Key | Value | Environment |
|---|---|---|
| `R2_ACCOUNT_ID` | Cloudflare 우측 상단 Account ID (32자 hex) | Production + Preview |
| `R2_ACCESS_KEY_ID` | 3단계에서 발급 | Production + Preview |
| `R2_SECRET_ACCESS_KEY` | 3단계에서 발급 | Production + Preview (Sensitive) |
| `R2_BUCKET` | `nutunion-media` | Production + Preview |
| `R2_PUBLIC_URL` | `https://cdn.nutunion.co.kr` (B 선택 시) 또는 생략 (A 선택 시) | Production + Preview |

설정 후 Vercel **Redeploy** 한 번 필수 (환경변수 반영).

## 5. CORS 설정 (브라우저 직접 업로드를 위해)

R2 버킷 → Settings → **CORS Policy** → 다음 JSON 붙여넣기:

```json
[
  {
    "AllowedOrigins": ["https://nutunion.co.kr", "http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type", "x-amz-*"],
    "MaxAgeSeconds": 3000
  }
]
```

## 6. 검증

Vercel 배포 후:

1. `https://nutunion.co.kr/chat` → 파일 첨부
2. 토스트에 "자료실 자동 등록 · **R2**" 가 뜨면 성공
3. 여전히 "· SUPABASE" 가 뜨면 환경변수 누락 — Vercel Functions 로그 확인:
   - `[r2 presign]` 에러가 있는지
   - `R2 not configured` 메시지가 있는지

## 7. 기존 Supabase 파일 이관 (선택)

Migration 089 실행 후 `storage_type='supabase'` 인 파일만 조회해 R2 로 옮길 수 있습니다:

```sql
select id, file_url, file_name, storage_type
from file_attachments
where storage_type = 'supabase'
order by created_at desc
limit 100;
```

이관 스크립트는 별도 작업 — 규모가 커지기 전(1GB 이하)에 해두면 Supabase egress 비용 거의 0.

## 8. 비용 구조 요약

| 항목 | R2 | Supabase | AWS S3 |
|---|---|---|---|
| 저장 | 의 1GB/월 | ~1GB/월 | 의 1GB/월 |
| Egress (다운로드) | **무료** | 9/GB | 9/GB |
| 요청 | Class A 5/million, Class B 0.36/million | 포함 | 4/million |

**1만 유저 규모에서 월 100GB egress 가정** → S3는 에, R2는 무료.

## 9. Google Drive 병용 (차기 세션)

- 대용량 영상/원본 자료는 Google Drive (유저 개인 용량 활용)
- Drive 링크를 `file_attachments` 에 `storage_type='google_drive'` 로 기록
- 현재 구현: 기존 Google Drive OAuth 연동은 설정 페이지에 있고, Picker UI 는 다음 세션에 추가
