# Genesis 마인드맵 대시보드 — 구현 마스터 플랜

> 파편화된 정보(너트/볼트/일정/이슈)를 하나의 시각적 맥락으로. 중앙 Genesis AI 노드가 모든 가지의 허브가 되어, 사용자가 "오늘 가장 먼저 할 일은?" 같은 질문 → 관련 노드를 하이라이트하는 인터랙티브 대시보드.

## 0. 데이터 모델

기존 인프라 100% 재사용 — 새 테이블/마이그레이션 없음.

| 노드 종류 | 색상 | 데이터 소스 | 카운트 기준 |
|---|---|---|---|
| **Center** Genesis AI | 흰색 + 굵은 검정 테두리 | `/api/genesis/plan` (post-on-submit) | — |
| **Nuts** 너트 | 핑크 (`bg-nu-pink/10`) | `group_members` join `groups` (status=active) | 사용자가 속한 그룹 |
| **Bolts** 볼트 | 엠버 (`bg-nu-amber/10`) | `project_members` join `projects` (status in active/draft) | 사용자가 속한 프로젝트 |
| **Schedule** 일정 | 민트 (`bg-emerald-100`) | `meetings` + `events` 다음 7일 | 다가오는 일정 (최대 5) |
| **Issues** 이슈 | 레드 (`bg-red-100`) | `project_tasks` overdue + 알림 unread (mention) | 긴급 처리 필요 |

각 노드 → 클릭 시 drawer로 상세. drawer는 기존 `<Sheet>` 또는 신설.

## 1. 컴포넌트 트리

```
app/(main)/dashboard/page.tsx
└─ DashboardViewToggle (Phase A)
   ├─ "list" → DashboardTabs (기존)
   └─ "mindmap" → MindMapDashboard (신설)
        ├─ ReactFlowProvider (Phase B)
        ├─ <ReactFlow nodes={...} edges={...}>
        │   ├─ CenterNode (Genesis AI input)        — Phase C
        │   ├─ NutNode (각 그룹)                     — Phase B
        │   ├─ BoltNode (각 프로젝트)                — Phase B
        │   ├─ ScheduleNode (다가오는 일정)          — Phase B
        │   └─ IssueNode (긴급 이슈)                  — Phase B
        ├─ <Controls> (zoom/fit)                     — Phase D
        ├─ <MiniMap>                                 — Phase D
        └─ <NodeDrawer> (click→상세)                 — Phase B
```

## 2. 단계별 명세

### Phase A — 전환 버튼 (30분, 1 commit)
- 헤더에 토글 버튼: `[리스트 ⇄ 마인드맵]`
- 클릭 시 sonner 토스트 "마인드맵 뷰 곧 공개됩니다"
- 사용자 상태는 `localStorage("dashboard.view")`에 저장 — 향후 phase B에서 활용
- **파일**: `components/dashboard/view-toggle.tsx` (신설), dashboard page header에 마운트

### Phase B — reactflow 정적 마인드맵 (3-5h)
- `npm i reactflow` (~30KB gz)
- `MindMapDashboard.tsx` 신설:
  - 서버에서 nuts/bolts/schedule/issues 데이터 묶어서 전달 (page.tsx 추가 fetch)
  - 각 종류별 노드 컴포넌트 (NutNode, BoltNode, ...) — neo-brutalism (`border-[3px]` shadow)
  - 중앙→가지 자동 레이아웃: dagre layout 또는 단순 방사형 (12시 방향부터 360°/N)
  - 노드 클릭 → 우측 sheet drawer (`<NodeDrawer file={...}>`) 열림
  - drawer는 노드 종류별 다른 콘텐츠 (너트→멤버수/마지막 활동, 볼트→상태/마일스톤, 일정→시간/장소)
- 토글이 "mindmap" 일 때만 마운트 (lazy `next/dynamic` 으로 reactflow 번들 지연 로드)

### Phase C — Genesis AI 중앙 노드 (1-2h)
- `CenterNode` 안에 입력 필드 + 전송 버튼
- 전송 → 기존 `POST /api/genesis/plan` 호출 (existing) — answer + suggested_roles + first_tasks 추출
- 응답:
  - **답변 텍스트**: 토스트 또는 노드 아래 작은 popover
  - **하이라이트**: 응답 phases / first_tasks 의 키워드와 매칭되는 기존 노드 → border 강조 (펄스 애니메이션)
  - **임시 노드**: AI가 제안한 새 task → 임시 IssueNode 로 추가 (저장은 클릭→bolt에 add)
- 입력 디바운싱 + lease 기반 idempotency (이미 `/api/genesis/plan`에 구현됨)

### Phase D — 폴리시 (1 세션)
- `<Controls>` zoom in/out + fit view
- `<MiniMap>` 우측 하단
- 모바일: 화면 < 768px 시 **fit-to-view + pinch zoom only** (reactflow 기본 지원)
- 색상 시스템 명문화 — `lib/dashboard/mindmap-colors.ts`
- 영속화: 노드 위치를 사용자가 드래그한 경우 `localStorage("dashboard.mindmap.layout")` 저장, 다음 방문 시 복원
- `<MindMapDashboard>` Suspense 경계 + skeleton

## 3. 타입 정의

```ts
// lib/dashboard/mindmap-types.ts (Phase B 신설)
export type NodeKind = "center" | "nut" | "bolt" | "schedule" | "issue";

export interface MindMapNodeData {
  kind: NodeKind;
  title: string;
  subtitle?: string;
  badge?: string;          // "5명", "마감 D-2"
  href?: string;           // 클릭→navigate
  meta?: Record<string, unknown>;  // drawer 용
}
```

## 4. 위험 + 완화

| 위험 | 완화 |
|---|---|
| reactflow 초기 번들 +30KB | `next/dynamic({ ssr: false })` 로 마인드맵 뷰 진입 시에만 로드 |
| 대량 노드(50+) 렌더 성능 | 노드 종류별 상한 (너트/볼트 10, 일정 5, 이슈 5) — 그 이상은 "+N more" 노드 |
| 사용자별 레이아웃 저장 충돌 | localStorage 만 사용, 서버 저장 안 함 (개인 시각화 선호도) |
| 모바일 터치 — 드래그 vs 스크롤 | reactflow `panOnDrag={false}` + `panOnScroll={true}` |

## 5. 테스트 시나리오

- [ ] 토글 버튼 클릭 → 뷰 전환 + localStorage 저장
- [ ] 너트 0개 사용자 → 빈 상태 노드 ("너트 만들기" 안내)
- [ ] 볼트 클릭 → drawer 열림 → 닫힘
- [ ] Genesis 입력 → 응답 → 관련 노드 펄스
- [ ] 모바일 가로/세로 회전 → 레이아웃 깨짐 없음
- [ ] reactflow 미로드 환경 (slow network) → 스켈레톤 표시

---

각 phase는 별도 commit. tsc 통과 + 뷰 전환 동작 확인 후 다음 phase.
