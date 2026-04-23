import { createBrowserClient } from "@supabase/ssr";
// import type { Database } from "./database.types";
// ↑ 실제 `npm run types:supabase` 실행 후 아래 제네릭을 <Database> 로 교체.
//   현재 scaffold 상태에서는 제네릭 미사용 (기존 any 추론 유지, 기존 코드 호환).

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
