// Supabase Database types — scaffold.
//
// 이 파일은 `npm run types:supabase` 로 자동 생성됩니다.
// 현재는 플레이스홀더 (수동 선언) — Supabase 액세스 토큰 설정 후 재생성 권장.
//
// 재생성:
//   1) https://supabase.com/dashboard/account/tokens 에서 personal access token 발급
//   2) SUPABASE_ACCESS_TOKEN=<token> npm run types:supabase
//
// 생성 후: 이 파일 전체가 실제 schema 로 교체됨. Database 제네릭이 client/server 에 주입되어
// `supabase.from("projects").select()` 결과가 자동 타입 추론됨.

// ── 스카폴드 (실제 gen 전 플레이스홀더) ──────────────────────────────
// 주요 테이블만 최소 필드로 선언. 누락 컬럼은 `[key: string]: unknown` 으로 tolerant 처리.

type BaseRow = { id: string; created_at?: string; updated_at?: string };

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: BaseRow & {
          nickname?: string | null;
          name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          role?: string | null;
          grade?: string | null;
          interests?: string[] | null;
          points?: number | null;
          activity_score?: number | null;
          skill_tags?: string[] | null;
          google_access_token?: string | null;
          can_create_crew?: boolean | null;
          [key: string]: unknown;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      groups: {
        Row: BaseRow & {
          name: string;
          description?: string | null;
          category?: string | null;
          host_id?: string | null;
          is_active?: boolean | null;
          max_members?: number | null;
          [key: string]: unknown;
        };
        Insert: Partial<Database["public"]["Tables"]["groups"]["Row"]> & { name: string };
        Update: Partial<Database["public"]["Tables"]["groups"]["Row"]>;
      };
      projects: {
        Row: BaseRow & {
          title: string;
          description?: string | null;
          status: string;
          category?: string | null;
          host_id?: string | null;
          venture_mode?: boolean | null;
          venture_stage?: string | null;
          closed_at?: string | null;
          [key: string]: unknown;
        };
        Insert: Partial<Database["public"]["Tables"]["projects"]["Row"]> & { title: string; status: string };
        Update: Partial<Database["public"]["Tables"]["projects"]["Row"]>;
      };
      group_members: {
        Row: BaseRow & {
          group_id: string;
          user_id: string;
          role: string;
          status: string;
          [key: string]: unknown;
        };
        Insert: Partial<Database["public"]["Tables"]["group_members"]["Row"]> & {
          group_id: string;
          user_id: string;
          role: string;
        };
        Update: Partial<Database["public"]["Tables"]["group_members"]["Row"]>;
      };
      project_members: {
        Row: BaseRow & {
          project_id: string;
          user_id: string;
          role?: string | null;
          reward_ratio?: number | null;
          [key: string]: unknown;
        };
        Insert: Partial<Database["public"]["Tables"]["project_members"]["Row"]> & {
          project_id: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["project_members"]["Row"]>;
      };
      notifications: {
        Row: BaseRow & {
          user_id: string;
          type: string;
          title?: string | null;
          body?: string | null;
          metadata?: Record<string, unknown> | null;
          is_read?: boolean | null;
          [key: string]: unknown;
        };
        Insert: Partial<Database["public"]["Tables"]["notifications"]["Row"]> & {
          user_id: string;
          type: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
      };
      workflow_jobs: {
        Row: BaseRow & {
          task_type: string;
          status: string;
          created_by: string | null;
          group_id: string | null;
          project_id: string | null;
          input: Record<string, unknown>;
          output: Record<string, unknown> | null;
          error_message: string | null;
          attempts: number;
          max_attempts: number;
          started_at: string | null;
          completed_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["workflow_jobs"]["Row"]> & {
          task_type: string;
        };
        Update: Partial<Database["public"]["Tables"]["workflow_jobs"]["Row"]>;
      };
    } & {
      // Catch-all: 다른 모든 테이블. 실제 gen 후에는 구체 타입으로 대체됨.
      [K: string]: {
        Row: Record<string, unknown> & { id?: string; created_at?: string };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
    };
    Views: { [K: string]: { Row: Record<string, unknown> } };
    Functions: { [K: string]: { Args: Record<string, unknown>; Returns: unknown } };
    Enums: { [K: string]: string };
    CompositeTypes: { [K: string]: Record<string, unknown> };
  };
}

/** Supabase 가 자동 생성하는 헬퍼 타입들 — gen 후에도 동일 패턴 */
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
