# Empty State 매핑 가이드

9종 사전 정의 컴포넌트를 아래 경로/조건에 연결:

| 위치 | 조건 | 컴포넌트 |
|---|---|---|
| `/dashboard` | `profile.onboarded_at === null && memberships.length === 0` | `<EmptyDashboardNewbie nickname={nickname}/>` |
| `/dashboard/my-lists` (나의 너트 섹션) | `memberships.length === 0` | `<EmptyMyNuts/>` |
| `/dashboard/my-lists` (나의 볼트 섹션) | `projectMemberships.length === 0` | `<EmptyMyBolts/>` |
| `/dashboard/activity-feed` | `events.length === 0` | `<EmptyActivityFeed hasNuts={memberships.length > 0}/>` |
| `/portfolio/[id]` (강성 위젯) | `stiffness === 0` | `<EmptyStiffness/>` |
| `/groups` / `/projects` (검색) | `query && results.length === 0` | `<EmptySearch query={q}/>` |
| `/groups/[id]` (게시물 탭) | `posts.length === 0 && isHost` | `<EmptyNutPosts/>` |
| `/projects/[id]/applications` | `applications.length === 0 && isPM` | `<EmptyApplications/>` |
| 전역 (offline) | `!navigator.onLine` | `<EmptyOffline/>` |

## 사용 예

```tsx
import { EmptyActivityFeed } from "@/components/empty/empty-state";

{events.length === 0 ? (
  <EmptyActivityFeed hasNuts={myGroups.length > 0} />
) : (
  <ul>...</ul>
)}
```

## 원칙
- Hero 감각은 visual 한 조각으로만 (⊕·Liquid 풀 노출 금지)
- CTA 는 반드시 1개 이상 (다음 행동 유도)
- 부정어 금지 (`없어요` → 뒤에 긍정 행동 반드시)
