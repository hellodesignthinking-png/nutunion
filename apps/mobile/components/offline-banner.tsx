import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { subscribeOnlineStatus, flushMutations } from "@/lib/sync/sync-engine";
import { pendingMutations } from "@/lib/sync/db";
import { BRAND } from "../../../packages/shared/brand-tokens";

/** 오프라인/대기 큐 상태 배너 — 탭 상단에 고정. */
export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    const unsub = subscribeOnlineStatus(setOnline);
    const tick = async () => {
      const q = await pendingMutations();
      setQueueCount(q.length);
    };
    tick();
    const interval = setInterval(tick, 5000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    // 온라인 복귀 시 flush
    if (online && queueCount > 0) {
      flushMutations().then(() => {
        pendingMutations().then((q) => setQueueCount(q.length));
      });
    }
  }, [online, queueCount]);

  if (online && queueCount === 0) return null;

  return (
    <View style={[styles.banner, !online && styles.offline]}>
      <Text style={styles.text}>
        {!online
          ? `⚡ 오프라인 — 캐시된 데이터 표시 중`
          : `🔄 동기화 중... (대기 ${queueCount}건)`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#FFF4E0",
    borderBottomWidth: 2,
    borderBottomColor: BRAND.colors.ink,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  offline: { backgroundColor: "#FEE2E2" },
  text: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: BRAND.colors.ink,
    textTransform: "uppercase",
  },
});
