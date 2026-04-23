# nutunion Mobile — EAS 배포 가이드 (v1)

Expo Application Services (EAS) 로 iOS / Android 배포.

## 📱 v1 MVP 범위
- 로그인 / 세션 유지 (Supabase)
- 푸시 알림 수신 (expo-notifications)
- 너트/볼트/대시보드 읽기
- 이벤트 QR 체크인 (카메라)
- 오프라인 sync (expo-sqlite)

## 🚀 첫 배포 순서

### 1. EAS 프로젝트 연결 (최초 1회)
```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init            # projectId 자동 할당 → app.json 에 주입
npx eas-cli@latest project:info    # 정보 확인
```

### 2. EAS Secrets 주입
```bash
npx eas-cli@latest secret:create --scope project --name APPLE_ID --value "your@apple.com"
npx eas-cli@latest secret:create --scope project --name ASC_APP_ID --value "1234567890"
npx eas-cli@latest secret:create --scope project --name APPLE_TEAM_ID --value "ABCDE12345"
```

### 3. Preview 빌드 (TestFlight / Play Internal)
```bash
npm run build:preview
```

### 4. 스토어 업로드
```bash
npm run submit:preview:ios       # TestFlight 자동 업로드
npm run submit:preview:android   # Play Internal (draft)
```

### 5. OTA Updates
```bash
npm run update:preview -- "v1 MVP 초기 UX 개선"
npm run update:prod -- "v1.0.1 버그 수정"
```

## 📊 릴리스 트래킹
`/api/admin/mobile-releases` 로 각 빌드/제출 기록:
```bash
curl -X POST https://nutunion.co.kr/api/admin/mobile-releases \
  -H "Content-Type: application/json" \
  -H "Cookie: $ADMIN_SESSION" \
  -d '{"platform":"ios","channel":"preview","version":"0.1.0","buildNumber":3,"easBuildId":"xxx","storeUrl":"https://testflight.apple.com/join/xxx","changelog":"v1 MVP","status":"submitted"}'
```

## 🔑 환경변수 체크리스트

### EAS Secrets (민감)
- `APPLE_ID`, `ASC_APP_ID`, `APPLE_TEAM_ID`
- `EXPO_APPLE_APP_SPECIFIC_PASSWORD`

### apps/mobile/.env.local (클라이언트 bundle)
```
EXPO_PUBLIC_API_URL=https://nutunion.co.kr
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=xxx
```

### secrets/play-service-account.json
Google Play Console → 설정 → API 액세스 → 서비스 계정 키.

## 📋 출시 전 체크리스트
- [ ] `app.json` version 확인
- [ ] 푸시 알림 권한 안내 문구 (`NSUserTrackingUsageDescription`, `POST_NOTIFICATIONS`)
- [ ] 개인정보처리방침 URL
- [ ] 앱 아이콘·스플래시 1024x1024
- [ ] TestFlight 내부 테스터 5명 이상 등록
- [ ] Play Console Internal Test 목록 설정
- [ ] `/api/admin/mobile-releases` 로 메타데이터 기록

## 🐛 문제 해결
- **"No credentials found"**: `npx eas-cli credentials`
- **OTA 업데이트 미반영**: app version 이 바뀌면 OTA 불가 — 스토어 재빌드 필요
- **iOS 심사 반려**: HTTPS 전용, 권한 설명, 로그인 전 첫 화면 콘텐츠 여부 확인
