# nutunion Mobile (Expo)

React Native 앱. **Phase 1~3 스캐폴드 완료** — 실행하려면 의존성 설치 필요.

## 구조

```
apps/mobile/
├── package.json           Expo SDK 51 + expo-router + Supabase + expo-sqlite + NetInfo
├── app.json               iOS/Android 설정 + 딥링크
├── tsconfig.json          @ / @shared 경로
├── lib/
│   ├── supabase.ts             AsyncStorage 세션
│   ├── api.ts                  Next.js API 래퍼 (Bearer token)
│   ├── use-push-notifications.ts   Expo Push Token 등록 훅
│   └── sync/
│       ├── db.ts               expo-sqlite 로컬 캐시 + mutation queue
│       ├── sync-engine.ts      NetInfo 기반 온라인 감지 + 큐 flush
│       └── use-synced-data.ts  useBolts / useApprovals 훅
├── components/
│   └── offline-banner.tsx      오프라인 / 대기 큐 상태 배너
└── app/
    ├── _layout.tsx             인증 가드
    ├── (auth)/login.tsx        이메일 OTP
    ├── (tabs)/
    │   ├── _layout.tsx         하단 5탭
    │   ├── index.tsx           홈
    │   ├── bolts.tsx           볼트 (SQLite read-through)
    │   ├── nuts.tsx            그룹
    │   ├── approvals.tsx       결재 (SQLite read-through)
    │   └── profile.tsx         프로필 + 푸시 상태
    ├── bolt/[id].tsx           볼트 상세 (마감 요약 포함)
    ├── bolt/[id]/digests.tsx   카톡 회의록 조회 + AI 생성
    └── approval/[id].tsx       결재 상세 + 승인/반려 (오프라인 큐)
```

## Phase 체크리스트

### ✅ Phase 1 — MVP
- [x] 이메일 OTP 로그인
- [x] 인증 상태 기반 라우팅 가드
- [x] 볼트/너트 목록
- [x] 볼트 상세 (마감 요약 포함)
- [x] 프로필
- [x] Expo Push Token 등록

### ✅ Phase 2 — 핵심 기능
- [x] 결재 목록 + 상세 + 승인/반려 처리
- [x] 카톡 회의록(chat-digest) 조회
- [x] 회의록 AI 생성 (카톡 대화 붙여넣기 → 요약)
- [x] 웹 API 재사용 (`/api/chat-digest`, `/api/finance/approvals/[id]`)

### ✅ Phase 3 — 오프라인
- [x] expo-sqlite 로컬 캐시 (bolts, approvals)
- [x] Read-through 패턴 — SQLite 먼저 리턴, 백그라운드 네트워크 갱신
- [x] Mutation queue — 오프라인 중 승인/반려 액션 큐 저장 → 복귀 시 자동 flush
- [x] NetInfo 기반 온라인 상태 구독
- [x] 오프라인 배너 (`OfflineBanner`)

### 🔜 Phase 4 — Native 이점 (추후)
- [ ] 생체인증 (expo-local-authentication)
- [ ] 홈 스크린 위젯 (iOS 14+/Android)
- [ ] 카메라 영수증 업로드 (expo-image-picker)

## 실행

```bash
cd apps/mobile

# 1) 의존성 설치
npm install

# 2) .env
cat > .env <<EOF
EXPO_PUBLIC_SUPABASE_URL=https://htmrdefcbslgwttjayxt.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
EXPO_PUBLIC_API_BASE=https://nutunion.co.kr
EOF

# 3) 실행
npx expo start

# 4) Expo Go 앱으로 QR 스캔 (iOS / Android 실기기 권장)
```

### 푸시 알림 테스트 (실기기 필요)

1. 앱 로그인 → 푸시 권한 허용
2. Supabase SQL Editor:
   ```sql
   select token from expo_push_tokens where user_id = auth.uid();
   ```
3. Expo Push Tool (https://expo.dev/notifications) 에서 직접 발송

### 오프라인 테스트

1. 볼트/결재 탭 방문 → 데이터 로드
2. 비행기 모드 ON
3. 앱 재시작 → 캐시 데이터 + "캐시 데이터" 배너 표시
4. 결재 승인 버튼 → "오프라인 — 네트워크 복귀 시 자동 처리" 알림
5. 비행기 모드 OFF → 배너가 "동기화 중..." 으로 전환 후 사라짐, 서버 반영 확인

## 빌드 / 배포

```bash
# Expo EAS 초기 설정
npx eas-cli@latest login
npx eas-cli@latest init

# 프리뷰 빌드 (QR 공유)
npx eas-cli@latest build --profile preview --platform ios

# 프로덕션 빌드
npx eas-cli@latest build --profile production --platform ios
npx eas-cli@latest submit --platform ios
```

## 공유 모듈 (`../../packages/shared/`)

| 모듈 | 용도 |
|---|---|
| `brand-tokens.ts` | 색상 hex / 보더 / 그림자 (웹 Tailwind ↔ RN StyleSheet 양쪽 호환) |
| `nav-links.ts` | 메뉴 구조 (하단 탭 매핑 재사용) |

웹 → 모바일 재사용 **불가** 컴포넌트:
- shadcn 컴포넌트 (DOM 기반)
- Tailwind 클래스 문자열
- Next.js 서버 컴포넌트

## 참고

- TypeScript 설정으로 메인 웹 빌드와 분리 (`tsconfig.json` / `.vercelignore` 에 제외됨)
- 브랜드 2.5px 보더 + font-mono-nu 는 RN StyleSheet 로 수동 포팅 (NativeWind 미사용 — 성능 + 의존성 단순화)
