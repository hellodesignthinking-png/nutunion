# nutunion × Google API 통합 가이드

> nutunion 플랫폼에 Google Workspace API를 연동하기 위한 전체 가이드

---

## 0. 사전 준비 — Google Cloud Console 설정

모든 Google API는 하나의 Google Cloud 프로젝트에서 관리합니다.

### 0-1. 프로젝트 생성 및 API 활성화

1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. **새 프로젝트 만들기** → 프로젝트 이름: `nutunion-prod`
3. **API 및 서비스 → 라이브러리**에서 아래 5개 API 모두 활성화:
   - Google Drive API
   - Google Docs API
   - Google Sheets API
   - Google Slides API
   - Google Calendar API

### 0-2. OAuth 2.0 클라이언트 생성

1. **API 및 서비스 → 사용자 인증 정보 → OAuth 클라이언트 ID 만들기**
2. 애플리케이션 유형: **웹 애플리케이션**
3. 승인된 리디렉션 URI:
   - `http://localhost:3000/api/auth/callback/google` (개발용)
   - `https://nutunion.co.kr/api/auth/callback/google` (프로덕션)
4. 생성 후 **클라이언트 ID**와 **클라이언트 시크릿** 메모

### 0-3. OAuth 동의 화면 설정

1. **API 및 서비스 → OAuth 동의 화면**
2. 사용자 유형: **외부**
3. 앱 이름: `너트유니온`
4. 범위 추가:
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/documents.readonly`
   - `https://www.googleapis.com/auth/spreadsheets.readonly`
   - `https://www.googleapis.com/auth/presentations.readonly`
   - `https://www.googleapis.com/auth/calendar.events`
5. 테스트 사용자에 본인 이메일 추가 (심사 전까지 테스트 사용자만 이용 가능)

### 0-4. 환경변수 설정

`.env.local` 파일에 추가:

```env
# Google OAuth
GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=https://nutunion.co.kr/api/auth/callback/google
```

Vercel에도 동일하게 추가: **Vercel Dashboard → Settings → Environment Variables**

### 0-5. 패키지 설치

```bash
npm install googleapis
```

---

## 1. OAuth 인증 플로우 (공통)

모든 API에 앞서 사용자 인증이 필요합니다. 한 번 인증하면 모든 Google 서비스를 이용할 수 있습니다.

### 1-1. 인증 시작 라우트

**`app/api/auth/google/route.ts`**

```typescript
import { google } from "googleapis";
import { NextResponse } from "next/server";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// 모든 Google 서비스 범위를 한 번에 요청
const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/presentations.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

export async function GET() {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",        // refresh_token 발급
    prompt: "consent",             // 매번 동의 화면 표시 (refresh_token 보장)
    scope: SCOPES,
  });
  return NextResponse.redirect(url);
}
```

### 1-2. 콜백 처리 라우트

**`app/api/auth/callback/google/route.ts`**

```typescript
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect("/dashboard?error=no_code");

  // 인증 코드 → 토큰 교환
  const { tokens } = await oauth2Client.getToken(code);

  // Supabase에 토큰 저장
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    await supabase.from("profiles").update({
      google_access_token: tokens.access_token,
      google_refresh_token: tokens.refresh_token,
      google_token_expiry: new Date(tokens.expiry_date!).toISOString(),
    }).eq("id", user.id);
  }

  return NextResponse.redirect("/dashboard?google=connected");
}
```

### 1-3. 토큰 자동 갱신 헬퍼

**`lib/google/auth.ts`**

```typescript
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";

export async function getGoogleClient(userId: string) {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("google_access_token, google_refresh_token, google_token_expiry")
    .eq("id", userId)
    .single();

  if (!profile?.google_access_token) {
    throw new Error("Google 계정이 연결되지 않았습니다.");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: profile.google_access_token,
    refresh_token: profile.google_refresh_token,
  });

  // 토큰 만료 시 자동 갱신
  const now = new Date();
  const expiry = new Date(profile.google_token_expiry);
  if (now >= expiry && profile.google_refresh_token) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    await supabase.from("profiles").update({
      google_access_token: credentials.access_token,
      google_token_expiry: new Date(credentials.expiry_date!).toISOString(),
    }).eq("id", userId);
  }

  return oauth2Client;
}
```

### 1-4. 필요한 DB 컬럼 추가 (Supabase SQL Editor)

```sql
-- profiles 테이블에 Google 토큰 컬럼 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_access_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_token_expiry TIMESTAMPTZ;
```

---

## 2. Google Drive API — 파일 탐색 및 연동

프로젝트 자료실에서 Drive 파일을 직접 불러오거나 첨부할 수 있습니다.

### 2-1. API Route

**`app/api/google/drive/route.ts`**

```typescript
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGoogleClient } from "@/lib/google/auth";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await getGoogleClient(user.id);
  const drive = google.drive({ version: "v3", auth });

  const query = req.nextUrl.searchParams.get("q") || "";
  const folderId = req.nextUrl.searchParams.get("folderId");

  const res = await drive.files.list({
    pageSize: 30,
    q: folderId
      ? `'${folderId}' in parents and trashed = false`
      : query
        ? `name contains '${query}' and trashed = false`
        : "trashed = false",
    fields: "files(id, name, mimeType, webViewLink, iconLink, thumbnailLink, modifiedTime, size)",
    orderBy: "modifiedTime desc",
  });

  return NextResponse.json({ files: res.data.files || [] });
}
```

### 2-2. 활용 예시

| 기능 | 사용처 | 설명 |
|------|--------|------|
| 파일 목록 조회 | 프로젝트 자료실 | Drive에서 파일 목록 불러오기 |
| 폴더 탐색 | 자료실 탐색기 | 폴더별 파일 브라우징 |
| 파일 검색 | 통합 검색 | 키워드로 Drive 파일 검색 |
| 파일 링크 임베드 | 게시글/회의록 | webViewLink로 직접 연결 |

---

## 3. Google Docs API — 문서 읽기 및 임포트

회의록, 기획 문서 등을 Docs에서 바로 불러와서 nutunion 내에서 볼 수 있습니다.

### 3-1. API Route

**`app/api/google/docs/[docId]/route.ts`**

```typescript
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGoogleClient } from "@/lib/google/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const { docId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await getGoogleClient(user.id);
  const docs = google.docs({ version: "v1", auth });

  const doc = await docs.documents.get({ documentId: docId });

  // 문서 내용을 텍스트로 추출
  const content = doc.data.body?.content
    ?.map((block: any) =>
      block.paragraph?.elements
        ?.map((el: any) => el.textRun?.content || "")
        .join("") || ""
    )
    .join("") || "";

  return NextResponse.json({
    title: doc.data.title,
    content,
    documentId: doc.data.documentId,
  });
}
```

### 3-2. 활용 예시

| 기능 | 사용처 | 설명 |
|------|--------|------|
| 문서 내용 미리보기 | 자료실 뷰어 | 문서 내용을 nutunion 내에서 렌더링 |
| 회의록 임포트 | 소모임 회의 | Docs 회의록을 미팅노트로 가져오기 |
| 기획문서 연동 | 프로젝트 워크스페이스 | 프로젝트 기획서 직접 조회 |

---

## 4. Google Sheets API — 스프레드시트 데이터 연동

정산, 예산, 출석 등의 데이터를 Sheets에서 실시간으로 읽어올 수 있습니다.

### 4-1. API Route

**`app/api/google/sheets/[sheetId]/route.ts`**

```typescript
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGoogleClient } from "@/lib/google/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sheetId: string }> }
) {
  const { sheetId } = await params;
  const range = req.nextUrl.searchParams.get("range") || "Sheet1!A1:Z100";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await getGoogleClient(user.id);
  const sheets = google.sheets({ version: "v4", auth });

  // 시트 메타데이터 (시트 이름 목록)
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const sheetNames = meta.data.sheets?.map((s: any) => s.properties?.title) || [];

  // 데이터 조회
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  });

  const rows = res.data.values || [];
  const headers = rows[0] || [];
  const data = rows.slice(1).map((row: any) =>
    Object.fromEntries(headers.map((h: string, i: number) => [h, row[i] || ""]))
  );

  return NextResponse.json({
    sheetNames,
    headers,
    data,
    totalRows: data.length,
  });
}
```

### 4-2. 활용 예시

| 기능 | 사용처 | 설명 |
|------|--------|------|
| 정산 데이터 가져오기 | 소모임 재무 | Sheets 정산표를 자동 임포트 |
| 출석 기록 동기화 | 소모임 관리 | Sheets 출석부 연동 |
| 예산 현황 대시보드 | 프로젝트 자금 | Sheets 예산표 실시간 반영 |

---

## 5. Google Slides API — 프레젠테이션 연동

프로젝트 발표 자료를 Slides에서 바로 보고, 슬라이드 내용을 요약할 수 있습니다.

### 5-1. API Route

**`app/api/google/slides/[presentationId]/route.ts`**

```typescript
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGoogleClient } from "@/lib/google/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ presentationId: string }> }
) {
  const { presentationId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await getGoogleClient(user.id);
  const slides = google.slides({ version: "v1", auth });

  const presentation = await slides.presentations.get({
    presentationId,
  });

  // 각 슬라이드에서 텍스트 추출
  const slidesSummary = (presentation.data.slides || []).map((slide: any, idx: number) => {
    const texts: string[] = [];
    (slide.pageElements || []).forEach((el: any) => {
      if (el.shape?.text?.textElements) {
        el.shape.text.textElements.forEach((te: any) => {
          if (te.textRun?.content?.trim()) {
            texts.push(te.textRun.content.trim());
          }
        });
      }
    });
    return {
      slideNumber: idx + 1,
      objectId: slide.objectId,
      texts,
    };
  });

  return NextResponse.json({
    title: presentation.data.title,
    totalSlides: presentation.data.slides?.length || 0,
    slides: slidesSummary,
    // 임베드용 URL
    embedUrl: `https://docs.google.com/presentation/d/${presentationId}/embed`,
  });
}
```

### 5-2. 슬라이드 썸네일 가져오기

```typescript
// 특정 슬라이드의 썸네일 이미지 URL 조회
export async function GET_THUMBNAIL(presentationId: string, slideId: string, auth: any) {
  const slides = google.slides({ version: "v1", auth });
  const thumbnail = await slides.presentations.pages.getThumbnail({
    presentationId,
    pageObjectId: slideId,
    "thumbnailProperties.thumbnailSize": "LARGE",
  });
  return thumbnail.data.contentUrl; // 썸네일 이미지 URL
}
```

### 5-3. 활용 예시

| 기능 | 사용처 | 설명 |
|------|--------|------|
| 슬라이드 미리보기 | 프로젝트 자료실 | 임베드로 슬라이드 뷰어 표시 |
| 발표 요약 | 활동 기록 | 각 슬라이드 텍스트 자동 요약 |
| 썸네일 표시 | 자료 목록 | 슬라이드 대표 이미지 카드 |
| 발표 자료 공유 | 소모임 게시판 | Slides 링크 자동 임베드 |

---

## 6. Google Calendar API — 일정 동기화

소모임 정기 모임, 프로젝트 마일스톤 등을 Google Calendar와 양방향으로 연동합니다.

### 6-1. API Route

**`app/api/google/calendar/route.ts`**

```typescript
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGoogleClient } from "@/lib/google/auth";

// 일정 목록 조회
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await getGoogleClient(user.id);
  const calendar = google.calendar({ version: "v3", auth });

  const now = new Date();
  const oneMonthLater = new Date(now);
  oneMonthLater.setMonth(now.getMonth() + 1);

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: now.toISOString(),
    timeMax: oneMonthLater.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 50,
  });

  return NextResponse.json({ events: res.data.items || [] });
}

// 새 일정 생성
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const auth = await getGoogleClient(user.id);
  const calendar = google.calendar({ version: "v3", auth });

  const event = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: body.title,
      description: body.description,
      location: body.location,
      start: { dateTime: body.startTime, timeZone: "Asia/Seoul" },
      end:   { dateTime: body.endTime,   timeZone: "Asia/Seoul" },
      attendees: body.attendees?.map((email: string) => ({ email })),
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 30 }] },
    },
  });

  return NextResponse.json({ event: event.data });
}
```

### 6-2. 활용 예시

| 기능 | 사용처 | 설명 |
|------|--------|------|
| 모임 일정 동기화 | 소모임 캘린더 | 정기모임 → Google Calendar 자동 추가 |
| 마일스톤 연동 | 프로젝트 로드맵 | 마일스톤 기한 → Calendar 이벤트 |
| 내 일정 보기 | 대시보드 | Calendar 일정을 대시보드에 표시 |

---

## 7. 전체 서비스 연결 구조도

```
사용자 브라우저
    │
    ├─ /api/auth/google ────────────→ Google OAuth 동의 화면
    │                                      │
    ├─ /api/auth/callback/google ←─────────┘ (code → tokens)
    │       │
    │       └─ Supabase profiles 테이블에 토큰 저장
    │
    ├─ /api/google/drive     ──→ Google Drive API v3
    ├─ /api/google/docs/[id] ──→ Google Docs API v1
    ├─ /api/google/sheets/[id]──→ Google Sheets API v4
    ├─ /api/google/slides/[id]──→ Google Slides API v1
    └─ /api/google/calendar  ──→ Google Calendar API v3
```

---

## 8. 전체 API 요약표

| 서비스 | API 버전 | 필요 스코프 | nutunion 활용처 |
|--------|----------|------------|-----------------|
| Drive | v3 | `drive.readonly` | 프로젝트 자료실, 파일 탐색 |
| Docs | v1 | `documents.readonly` | 회의록 임포트, 기획서 뷰어 |
| Sheets | v4 | `spreadsheets.readonly` | 정산 데이터, 출석, 예산 |
| Slides | v1 | `presentations.readonly` | 발표 자료 미리보기, 요약 |
| Calendar | v3 | `calendar.events` | 모임 일정, 마일스톤 알림 |

---

## 9. 구현 순서 (추천 로드맵)

### Phase 1: 인프라 (1일)
- [ ] Google Cloud 프로젝트 생성 및 5개 API 활성화
- [ ] OAuth 클라이언트 생성 및 동의 화면 설정
- [ ] `.env.local` + Vercel 환경변수 설정
- [ ] `npm install googleapis`
- [ ] Supabase profiles 테이블에 google 토큰 컬럼 추가

### Phase 2: 인증 (1일)
- [ ] `/api/auth/google` 인증 시작 라우트
- [ ] `/api/auth/callback/google` 콜백 라우트
- [ ] `lib/google/auth.ts` 토큰 갱신 헬퍼
- [ ] 대시보드에 "Google 계정 연결" 버튼 추가

### Phase 3: 핵심 API (2~3일)
- [ ] Drive API → 프로젝트 자료실 파일 연동
- [ ] Docs API → 회의록/문서 임포트
- [ ] Sheets API → 정산 데이터 연동
- [ ] Slides API → 발표 자료 미리보기
- [ ] Calendar API → 모임 일정 동기화

### Phase 4: UI 연동 (2~3일)
- [ ] Google Drive 파일 선택 모달 컴포넌트
- [ ] 임베드 뷰어 (Docs, Sheets, Slides 공통)
- [ ] Calendar 위젯 (대시보드/소모임)
- [ ] 연결 상태 관리 및 재인증 플로우

---

## 10. 보안 체크리스트

- [ ] `google_access_token`, `google_refresh_token` 컬럼에 RLS 정책 적용 (본인만 읽기)
- [ ] API Route에서 항상 Supabase auth 확인 후 Google API 호출
- [ ] refresh_token은 서버사이드에서만 사용 (클라이언트 노출 금지)
- [ ] OAuth 스코프는 필요한 최소 범위만 요청
- [ ] 프로덕션 전 Google OAuth 동의 화면 심사 제출 (사용자 100명 이상 시 필수)

---

*Last updated: 2026-04-08*
