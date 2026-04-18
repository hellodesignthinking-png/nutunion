// 데이터 훅 — read-through SQLite + 백그라운드 네트워크 갱신.

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabase";
import {
  cacheGet, cacheSet,
  upsertBolts, getCachedBolts, type CachedBolt,
  upsertApprovals, getCachedApprovals, type CachedApproval,
} from "./db";
import { subscribeOnlineStatus } from "./sync-engine";

const STALE_MS = 60_000; // 1분

/** 볼트 목록 훅 — 오프라인 우선, 네트워크 가용 시 갱신 */
export function useBolts() {
  const [data, setData] = useState<CachedBolt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const refresh = useCallback(async (force = false) => {
    setRefreshing(true);
    try {
      // 1. SQLite 우선
      const cached = await getCachedBolts();
      if (cached.length > 0) {
        setData(cached);
        setFromCache(true);
        setLoading(false);
      }

      // 2. 네트워크 동기화
      if (navigator.onLine !== false) {
        const { data: remote, error } = await supabase
          .from("projects")
          .select("id, title, description, status, category, closure_summary, closed_at")
          .order("created_at", { ascending: false })
          .limit(50);
        if (!error && remote) {
          const rows = remote as CachedBolt[];
          await upsertBolts(rows);
          setData(rows);
          setFromCache(false);
          await cacheSet("bolts:last_refresh", Date.now());
        }
      }
    } catch (err) {
      console.warn("[useBolts]", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const unsub = subscribeOnlineStatus((online) => {
      if (online) refresh();
    });
    return () => {
      unsub();
    };
  }, [refresh]);

  return { data, loading, refreshing, fromCache, refresh };
}

/** 결재 목록 훅 */
export function useApprovals() {
  const [data, setData] = useState<CachedApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const cached = await getCachedApprovals();
      if (cached.length > 0) {
        setData(cached);
        setFromCache(true);
        setLoading(false);
      }
      const { data: remote } = await supabase
        .from("approvals")
        .select("id, title, doc_type, amount, status, content, requester_name, approver_name, reject_reason, company, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (remote) {
        const rows = remote.map((r) => ({ ...r, id: String(r.id) })) as CachedApproval[];
        await upsertApprovals(rows);
        setData(rows);
        setFromCache(false);
      }
    } catch (err) {
      console.warn("[useApprovals]", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const unsub = subscribeOnlineStatus((online) => {
      if (online) refresh();
    });
    return () => unsub();
  }, [refresh]);

  return { data, loading, refreshing, fromCache, refresh };
}

/** 캐시 stale 여부 확인 (선택 사용) */
export async function isStale(key: string): Promise<boolean> {
  const entry = await cacheGet(`${key}:last_refresh`);
  if (!entry) return true;
  return entry.age > STALE_MS;
}
