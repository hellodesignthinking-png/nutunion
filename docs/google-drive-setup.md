# Google Drive 저장 전략 설정

너트/볼트의 공유 자료 폴더를 **조직 소유 Google Shared Drive** 에 저장하는 설정.
호스트 탈퇴/폴더 삭제 시 데이터 소실 방지.

## 현재 문제 (기본 설정)

- 너트/볼트 개설 시 호스트의 **개인 Google Drive 루트**에 폴더가 생성됨
- 호스트가 계정 삭제, 폴더 삭제, OAuth 연결 해제하면 **모든 자료 소실**
- 소유권이 개인에게 있으므로 조직 통제 불가

## 해결: Google Shared Drive 사용

Google Workspace 의 Shared Drive (공유 드라이브) 는:
- 파일 소유권이 **조직에 귀속** (개인이 아님)
- 멤버가 이탈해도 데이터 유지
- 권한 관리는 admin console 에서 중앙 통제

## 설정 절차 (Google Workspace 관리자)

### 1. Shared Drive 생성

Google Workspace admin console (`admin.google.com`) 또는 `drive.google.com/drive/shared-drives` 에서:
1. "공유 드라이브 만들기"
2. 이름: 예) `nutunion 커뮤니티 자료`
3. 만든 드라이브 열기 → URL 에서 ID 추출
   - `drive.google.com/drive/folders/0AAbCdefGHIJKlMnOPQ` → `0AAbCdefGHIJKlMnOPQ` 부분이 Shared Drive ID

### 2. (선택) 루트 폴더 생성

Shared Drive 안에 "너트/", "볼트/" 등의 카테고리 폴더를 먼저 만들고 싶다면:
- `nutunion 공유자료` 폴더 생성
- 폴더 열고 URL 에서 폴더 ID 추출

### 3. 서비스 사용자 권한 부여

플랫폼 호스트가 자기 계정으로 Shared Drive 폴더를 생성할 수 있어야 하므로,
**너트를 개설하는 모든 관리자/멤버**를 Shared Drive 의 Content manager 이상으로 추가:
- Shared Drive → 멤버 추가 → Content manager

또는 전체 nutunion 도메인(`@nutunion.co.kr`)을 Content manager 로 일괄 등록.

### 4. Vercel 환경변수 설정

```bash
vercel env add GOOGLE_SHARED_DRIVE_ID production
# 값: Shared Drive ID (단계 1 에서 복사)

# 선택 — 루트 폴더 (단계 2 사용 시)
vercel env add GOOGLE_SHARED_DRIVE_ROOT_FOLDER_ID production
# 값: 루트 폴더 ID
```

로컬 테스트는 `.env.local` 에 동일하게.

### 5. 배포 & 확인

```bash
vercel --prod
```

관리자 계정으로 접속 후:
`GET /api/google/drive/storage-status` 호출 →
```json
{
  "strategy": "shared-drive",
  "driveId": "0AAbCdef...",
  "description": "Google Shared Drive (0AAbCdef...) — 호스트 탈퇴 영향 없음"
}
```

## 기존 호스트 Drive 폴더 마이그레이션

이미 호스트 Drive 에 생성된 너트/볼트 폴더는 자동 이전되지 않습니다.
2가지 방법:

### A. 호스트가 직접 Shared Drive 로 이동

- 호스트 계정으로 Drive 접속
- 기존 너트 폴더 우클릭 → **이동** → Shared Drive 선택
- DB 의 `google_drive_folder_id` 는 그대로 유지됨 (ID 불변)

### B. 신규 폴더 생성 후 링크 갈아끼우기

- 너트/볼트 설정에서 "공유 폴더 다시 만들기"
- 새 폴더가 Shared Drive 에 생성되면서 DB 업데이트
- 기존 자료는 수동 복사 필요

## Fallback (Shared Drive 미설정 시)

`GOOGLE_SHARED_DRIVE_ID` 가 비어있으면 기존처럼 호스트 개인 Drive 사용 (하위 호환).
단, `/api/google/drive/storage-status` 가 경고 메시지 반환.

## 비용 / 제한

- Google Workspace Business Standard 이상 → Shared Drive 포함 (2TB/사용자 공유)
- Business Starter 는 Shared Drive 미지원 → Business Standard 이상 필요
- 개인 Gmail 계정으로는 Shared Drive 사용 불가

## 보안 참고

- Shared Drive 폴더는 기본적으로 **링크 공개 X** — Drive 멤버십 기반 접근
- 외부 공유가 필요하면 `drive.files.create` 후 별도 `permissions.create({ type: "anyone" })` 호출 필요
- 현재 `/api/google/drive/folder` 는 Shared Drive 전략에선 public permission 을 **부여하지 않음** (보안 기본값)
- 필요하면 너트/볼트 설정에서 명시적 "링크 공개" 토글 추가 고려
