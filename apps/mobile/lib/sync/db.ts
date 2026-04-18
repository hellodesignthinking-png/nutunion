// SQLite 로컬 캐시 — 오프라인 읽기 + 대기 큐 (mutation queue).
//
// 설계:
//   · 서버의 특정 쿼리 결과를 테이블별로 캐시 (bolts, approvals, digests)
//   · 네트워크 복귀 시 변경 큐 flush
//   · 간단한 "read-through" 패턴 — 우선 SQLite 리턴, 백그라운드에서 네트워크 갱신

import * as SQLite from "expo-sqlite";

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync("nutunion-cache.db");
  await migrate(dbInstance);
  return dbInstance;
}

async function migrate(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    pragma journal_mode = WAL;
    pragma foreign_keys = ON;

    create table if not exists cache (
      key text primary key,
      value text not null,
      updated_at integer not null
    );

    create table if not exists mutations (
      id integer primary key autoincrement,
      endpoint text not null,
      method text not null,
      body text,
      created_at integer not null,
      attempts integer not null default 0,
      last_error text
    );

    create table if not exists bolts (
      id text primary key,
      title text not null,
      description text,
      status text,
      category text,
      closure_summary text,
      closed_at text,
      updated_at integer not null
    );

    create table if not exists approvals (
      id text primary key,
      title text not null,
      doc_type text,
      amount integer,
      status text,
      content text,
      requester_name text,
      approver_name text,
      reject_reason text,
      company text,
      created_at text,
      updated_at integer not null
    );
  `);
}

// ── Generic cache (key → JSON) ──────────────────────────────────

export async function cacheGet<T = unknown>(key: string): Promise<{ value: T; age: number } | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string; updated_at: number }>(
    "select value, updated_at from cache where key = ?",
    [key]
  );
  if (!row) return null;
  return { value: JSON.parse(row.value) as T, age: Date.now() - row.updated_at };
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "insert or replace into cache (key, value, updated_at) values (?, ?, ?)",
    [key, JSON.stringify(value), Date.now()]
  );
}

// ── Table-specific helpers ──────────────────────────────────────

export interface CachedBolt {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  category: string | null;
  closure_summary: string | null;
  closed_at: string | null;
}

export async function upsertBolts(rows: CachedBolt[]): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDb();
  const now = Date.now();
  for (const r of rows) {
    await db.runAsync(
      `insert or replace into bolts
       (id, title, description, status, category, closure_summary, closed_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
      [r.id, r.title, r.description, r.status, r.category, r.closure_summary, r.closed_at, now]
    );
  }
}

export async function getCachedBolts(): Promise<CachedBolt[]> {
  const db = await getDb();
  return db.getAllAsync<CachedBolt>("select * from bolts order by updated_at desc limit 100");
}

export async function getCachedBolt(id: string): Promise<CachedBolt | null> {
  const db = await getDb();
  return (await db.getFirstAsync<CachedBolt>("select * from bolts where id = ?", [id])) ?? null;
}

export interface CachedApproval {
  id: string;
  title: string;
  doc_type: string | null;
  amount: number | null;
  status: string | null;
  content: string | null;
  requester_name: string | null;
  approver_name: string | null;
  reject_reason: string | null;
  company: string | null;
  created_at: string | null;
}

export async function upsertApprovals(rows: CachedApproval[]): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDb();
  const now = Date.now();
  for (const r of rows) {
    await db.runAsync(
      `insert or replace into approvals
       (id, title, doc_type, amount, status, content, requester_name, approver_name, reject_reason, company, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [r.id, r.title, r.doc_type, r.amount, r.status, r.content, r.requester_name, r.approver_name, r.reject_reason, r.company, r.created_at, now]
    );
  }
}

export async function getCachedApprovals(): Promise<CachedApproval[]> {
  const db = await getDb();
  return db.getAllAsync<CachedApproval>("select * from approvals order by created_at desc limit 100");
}

// ── Mutation queue (오프라인 쓰기 큐) ────────────────────────────

export interface QueuedMutation {
  id: number;
  endpoint: string;
  method: string;
  body: string | null;
  created_at: number;
  attempts: number;
  last_error: string | null;
}

export async function enqueueMutation(
  endpoint: string,
  method: string,
  body: unknown
): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    "insert into mutations (endpoint, method, body, created_at) values (?, ?, ?, ?)",
    [endpoint, method, body != null ? JSON.stringify(body) : null, Date.now()]
  );
  return result.lastInsertRowId as number;
}

export async function pendingMutations(): Promise<QueuedMutation[]> {
  const db = await getDb();
  return db.getAllAsync<QueuedMutation>(
    "select * from mutations order by created_at asc"
  );
}

export async function removeMutation(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("delete from mutations where id = ?", [id]);
}

export async function markMutationFailed(id: number, error: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "update mutations set attempts = attempts + 1, last_error = ? where id = ?",
    [error, id]
  );
}

export async function clearAllCache(): Promise<void> {
  const db = await getDb();
  await db.execAsync("delete from cache; delete from bolts; delete from approvals;");
}
