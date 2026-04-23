# Dashboard Audit — 2026-04

## 현재 렌더링 섹션
| 섹션 | 데이터 소스 | 로딩 | Empty State |
|---|---|---|---|
| OnboardingCoach | `profiles.onboarded_at` / groups / projects | Client CSR | ✅ |
| DashboardEmptyState | profile + counts | Server | ✅ |
| StiffnessBreakdown | `stiffness_breakdown` view | Client CSR | ✅ |
| DashboardAIAssistant | `/api/dashboard/ask` | Client | ✅ |
| Stats Cards (5) | counts (groups/projects/notifications) | Server | ❌ |
| MyTasksWidget | `project_tasks` | Dynamic/CSR | ✅ |
| MyCalendarWidget | events + meetings | Dynamic/CSR | ✅ |
| MyVentureBoltsWidget | `projects.venture_mode=true` | Dynamic/CSR | ✅ |
| recentActivity (inline) | `crew_posts` | Server | ❌ |

## 8개 필수 모듈 체크
| # | 모듈 | 상태 |
|---|---|---|
| ① Liquid Identity 배너 | ❌ 없음 |
| ② 강성 요약 | ✅ `StiffnessBreakdown` |
| ③ My 너트 리스트 | 🔸 count only — 리스트 없음 |
| ④ My 볼트 리스트 | 🔸 Venture 모드만 — 일반 볼트 누락 |
| ⑤ Activity Feed | ❌ 없음 (최대 공백) |
| ⑥ 추천 너트/볼트 | 🔸 OnboardingCoach 내부에만 |
| ⑦ 다가오는 일정 | ✅ `MyCalendarWidget` |
| ⑧ Quick Actions | 🔸 EmptyState 내부에만 — 상시 없음 |

## 이번 세션 구현 목표
1. **HeroSection + NBA 로직** (①②⑧ 통합)
2. **ActivityFeed** (⑤)
3. **Recommendations v1** (⑥) — AI 매칭 API 재활용
4. **My 너트/볼트 리스트** (③④)
5. **PWA manifest 보강** (모바일)
