# Hardcoded Values Audit — 2026-04

## 요약
- **~295개 hex 하드코딩** 발견 (`components/`, `app/` 하위 `.tsx`)
- 대부분 Tailwind `border-[#e5e5e5]`, `text-[#1a1a1a]` 형태 — 이미 CSS 변수화 가능
- **마이그레이션은 수동**: 각 값 의미(본문/보조/경계) 판단이 필요하므로 자동 치환 금지

## 우선 치환 대상 (Reader Mode 영역)

| 하드코딩 값 | 권장 토큰 |
|---|---|
| `#fafafa` | `var(--neutral-25)` or `bg-[color:var(--reader-bg)]` |
| `#ffffff` | `var(--neutral-0)` |
| `#e5e5e5` | `var(--neutral-100)` |
| `#f0f0f0` | `var(--reader-border-soft)` |
| `#1a1a1a` | `var(--neutral-900)` |
| `#737373` | `var(--neutral-500)` |
| `#d4d4d4` | `var(--neutral-200)` |
| `#FF3D88` | `var(--liquid-primary)` (Reader 액센트) |

## Scan 방법
```bash
grep -rn "#[0-9a-fA-F]\{6\}" components/ app/ --include="*.tsx" \
  | grep -v "node_modules\|\.next\|svg\|data:image"
```

## 마이그레이션 원칙
1. **랜딩·브랜드 페이지 (`components/landing/*`, `/brand/*`)** — Riso 하드코딩 유지 OK
2. **Reader 영역 (`/dashboard`, `/groups/[id]`, `/projects/[id]`, `/portfolio/*`)** — 토큰화 우선
3. **컴포넌트 라이브러리 (`components/ui/*`)** — shadcn 원본 유지
4. 치환 전후 스크린샷 비교 필수
