# Supabase Type Generation

실제 DB schema 를 TypeScript 타입으로 자동 생성 → `.from("table")` 호출이 자동 타입 추론됨.

## 최초 설정 (1회)

1. **Supabase CLI 설치** (이미 의존성에 없다면):
   ```bash
   npm install -g supabase
   # or 프로젝트 로컬
   npm install -D supabase
   ```

2. **Personal Access Token 발급**:
   https://supabase.com/dashboard/account/tokens → "Generate new token"

3. **쉘 환경변수 설정**:
   ```bash
   export SUPABASE_ACCESS_TOKEN="sbp_xxxx..."
   # 또는 .envrc / direnv 사용
   ```

## 타입 재생성

Schema 변경 후 마이그레이션 적용 후:

```bash
npm run types:supabase
```

이 명령은 `lib/supabase/database.types.ts` 를 **실제 스키마** 기반 타입으로 덮어씀.
현재는 플레이스홀더(수동 declaration) 상태.

## 사용 패턴

### 기본 (Database 제네릭 자동 주입)

```ts
import { createClient } from "@/lib/supabase/server";

const supabase = await createClient();
// ↓ project 는 자동으로 Tables<"projects">["Row"] 타입 추론
const { data: project } = await supabase
  .from("projects")
  .select("id, title, venture_mode")
  .eq("id", id)
  .single();
```

### 명시적 Row 타입 추출

```ts
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";

type Project = Tables<"projects">;
type ProjectInsert = TablesInsert<"projects">;
type ProjectUpdate = TablesUpdate<"projects">;
```

### Insert / Update

```ts
const payload: TablesInsert<"projects"> = {
  title: "New Bolt",
  status: "draft",
  // id, created_at 자동
};
await supabase.from("projects").insert(payload);
```

## CI / 자동화

GitHub Action 예시 (schema drift 감지):

```yaml
# .github/workflows/types-check.yml
name: types-check
on: [push, pull_request]
jobs:
  types:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run types:check
```

CI 에서 schema 가 drift 되어 `lib/supabase/database.types.ts` 가 stale 이면
실제 쿼리에서 타입 에러가 발생 → 재생성 필요 알림 역할.

## 장점

- `supabase.from("xxx")` 의 **모든** SELECT 결과가 자동 타입 추론
- Insert / Update payload 필수 컬럼 누락 시 TS 에러
- Column rename / drop 시 사용처 전체가 빨갛게 — 리팩토링 안전
- 수많은 `as any` 가 자연스럽게 사라짐

## 한계

- RLS / Function / Trigger 는 타입에 반영되지 않음 (권한은 런타임에서만 검증)
- Supabase 서버사이드 auth.users 등은 public schema 외부 — `--schema auth` 추가 필요
- Schema 변경 후 재생성 안 하면 stale — 자동화 권장
