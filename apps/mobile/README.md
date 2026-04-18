# nutunion Mobile (Expo)

React Native 앱 스캐폴딩. **아직 초기 단계** — 구조만 잡혀 있음.

## 전략

- **Expo (SDK 최신)** + **expo-router** (웹 App Router 와 유사한 파일 기반 라우팅)
- **Supabase 공용** — 웹과 동일 DB/Auth, 별도 스키마 없음
- **공유 모듈**: `packages/shared/` — nav-links, brand-tokens, 타입
- **UI**: React Native 기본 컴포넌트 + brand-tokens 적용 (shadcn 미사용 — 웹 전용)
- **딥 링크**: `nutunion://` 스킴 + `https://nutunion.co.kr` 유니버설 링크

## 초기 실행 (사용자 수동)

```bash
# 1. Expo 앱 생성
cd apps/
npx create-expo-app@latest mobile --template

# 2. 공유 모듈 링크 (pnpm workspace 권장, 또는 직접 import)
cd mobile
npm install ../../packages/shared

# 3. 환경변수 (.env)
EXPO_PUBLIC_SUPABASE_URL=https://htmrdefcbslgwttjayxt.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>

# 4. 실행
npx expo start
```

## 구현 계획

### Phase 1 — MVP
- [ ] 로그인 (Supabase email OTP 또는 OAuth)
- [ ] 볼트 목록 / 상세 조회
- [ ] 내 프로필
- [ ] 푸시 알림 (expo-notifications + Supabase webhook)

### Phase 2 — 핵심 기능
- [ ] 카톡 회의록 정리 (웹과 동일 `/api/chat-digest` 호출)
- [ ] 결재 상신/승인
- [ ] 지도/사진 접근 (expo-image-picker, expo-location)

### Phase 3 — 네이티브 이점
- [ ] 오프라인 읽기 (SQLite + Supabase sync)
- [ ] 생체인증 (expo-local-authentication)
- [ ] 홈 스크린 위젯 (iOS 14+/Android)

## 재사용되는 웹 모듈

| 모듈 | 역할 |
|---|---|
| `packages/shared/nav-links.ts` | 메뉴 구조 (하단 탭 매핑) |
| `packages/shared/brand-tokens.ts` | 색상/타이포/보더 |
| `lib/finance/*` (일부) | 포매터, 계산 로직 |

## 재사용 불가

- `components/ui/*` (shadcn, DOM 기반)
- Tailwind 클래스 (RN 은 style 객체 or NativeWind)
- Next.js 서버 컴포넌트

## 현재 완성도

- [x] 공유 모듈 `packages/shared/` 디렉토리
- [x] `brand-tokens.ts` — hex 값 노출 (RN 호환)
- [x] `nav-links.ts` — 재-export
- [ ] 실제 Expo 앱 코드 (사용자 명령 필요)
