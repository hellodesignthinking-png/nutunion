# nutunion Mobile — DEPLOY

> Detailed EAS guide: see [`EAS_DEPLOY.md`](./EAS_DEPLOY.md).

## TL;DR

```bash
cd apps/mobile

# 1) one-time
npx eas-cli@latest login
npx eas-cli@latest init           # writes projectId into app.json
npx eas-cli@latest secret:create --scope project --name APPLE_ID --value "you@apple.com"
npx eas-cli@latest secret:create --scope project --name ASC_APP_ID --value "1234567890"
npx eas-cli@latest secret:create --scope project --name APPLE_TEAM_ID --value "ABCDE12345"

# 2) preview build (TestFlight + Play Internal)
npm run build:preview
npm run submit:preview:ios
npm run submit:preview:android

# 3) OTA hotfix
npm run update:preview -- "v0.1.x bug fix"
```

## Required env

`apps/mobile/.env.local` (Expo public bundle):

```
EXPO_PUBLIC_API_BASE=https://nutunion.co.kr
EXPO_PUBLIC_SUPABASE_URL=https://htmrdefcbslgwttjayxt.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

These are also propagated through `eas.json` → `env.EXPO_PUBLIC_API_URL` for the build runners.

## Bundle identifiers

- iOS: `kr.co.nutunion.app`
- Android: `kr.co.nutunion.app`

(set in `app.json` — change before first store submission only.)

## Push notifications wiring

1. Login success in `app/(auth)/login.tsx` → `RootLayout` mounts `(tabs)`.
2. `(tabs)/profile.tsx` invokes `usePushNotifications()` which:
   - Requests notification permission
   - Fetches the Expo Push Token via `Notifications.getExpoPushTokenAsync({ projectId })`
   - Upserts to `expo_push_tokens` table (Supabase, RLS-protected)
3. The web side dispatches with `lib/push/dispatch.ts → dispatchPushToUsers(userIds, payload)`.
4. Optional REST path for non-direct DB clients: `POST /api/profile/push-token { token, platform }`.

## Smoke test (manual)

After `npm start` + Expo Go on a device:

1. Sign in via email OTP.
2. Pull-to-refresh on dashboard — morning briefing renders, stat chips populate.
3. Tap a quick action (`📝 새 노트`) — routes to /notes (web link until native screen lands).
4. 너트 / 볼트 tabs render lists pulled from Supabase.
5. AI tab — type "오늘 일정" and tap 전송 — assistant bubble appears.
6. 프로필 → 로그아웃 → returns to login.
7. Toggle airplane mode → make a thread_data add → reconnect → mutation flushes (📡 chip clears).

## Phase B preview (CRDT)

Out of scope for this session. When implemented:
- Adopt Yjs + y-supabase (or y-websocket) for collaborative thread_data
- Use `expo-sqlite` for local Y.Doc persistence
- Replace `mutateWithQueue` with Y.Doc transactions on contended threads
