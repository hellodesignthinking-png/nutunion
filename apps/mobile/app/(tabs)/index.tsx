import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { apiGet } from "@/lib/api";
import { pendingMutations } from "@/lib/sync/db";
import { OfflineBanner } from "@/components/offline-banner";
import { BRAND } from "../../../../packages/shared/brand-tokens";

interface Briefing {
  greeting?: string;
  summary?: string;
  stats?: {
    meetings?: number;
    todos?: number;
    overdue?: number;
    unread?: number;
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const data = await apiGet<Briefing>("/api/dashboard/morning-briefing");
      setBriefing(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "브리핑 로드 실패");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const updatePending = useCallback(async () => {
    try {
      const q = await pendingMutations();
      setPendingCount(q.length);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    load();
    updatePending();
    const t = setInterval(updatePending, 5000);
    return () => clearInterval(t);
  }, [load, updatePending]);

  const stats = briefing?.stats ?? {};

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <OfflineBanner />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={load}
            tintColor={BRAND.colors.pink}
          />
        }
      >
        {pendingCount > 0 && (
          <View style={styles.pendingChip}>
            <Text style={styles.pendingText}>📡 {pendingCount}건 대기 중</Text>
          </View>
        )}

        <View style={styles.heroCard}>
          <Text style={styles.kicker}>NUTUNION · 모닝 브리핑</Text>
          <Text style={styles.hero}>
            {loading ? "불러오는 중..." : briefing?.greeting ?? "좋은 아침입니다"}
          </Text>
          {briefing?.summary && <Text style={styles.subtitle}>{briefing.summary}</Text>}
          {error && <Text style={styles.error}>⚠ {error}</Text>}
        </View>

        <View style={styles.statRow}>
          <Stat label="미팅" value={stats.meetings ?? 0} />
          <Stat label="할일" value={stats.todos ?? 0} />
          <Stat label="밀린일" value={stats.overdue ?? 0} highlight={(stats.overdue ?? 0) > 0} />
          <Stat label="안읽음" value={stats.unread ?? 0} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>빠른 실행</Text>
          <QuickAction
            label="🌐 마인드맵 (생태계 미러)"
            onPress={() => router.push("/mindmap" as never)}
          />
          <QuickAction
            label="📝 새 노트"
            onPress={() => router.push("/notes" as never)}
          />
          <QuickAction
            label="📅 캘린더"
            onPress={() => router.push("/calendar" as never)}
          />
          <QuickAction
            label="🤖 AI 작전봉"
            onPress={() => router.push("/(tabs)/ai" as never)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.stat, highlight && styles.statHighlight]}>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, highlight && styles.statLabelHighlight]}>
        {label}
      </Text>
    </View>
  );
}

function QuickAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.action} activeOpacity={0.7}>
      <Text style={styles.actionText}>{label}</Text>
      <Text style={styles.actionArrow}>→</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND.colors.paper },
  container: { padding: 16, gap: 12 },
  pendingChip: {
    alignSelf: "flex-start",
    backgroundColor: BRAND.colors.amber,
    borderWidth: BRAND.borders.subtle,
    borderColor: BRAND.colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: "800",
    color: BRAND.colors.ink,
    letterSpacing: 1,
  },
  heroCard: {
    borderWidth: BRAND.borders.strong,
    borderColor: BRAND.colors.ink,
    backgroundColor: BRAND.colors.paper,
    padding: 20,
  },
  kicker: { fontSize: 10, letterSpacing: 4, color: BRAND.colors.graphite, fontWeight: "700" },
  hero: { fontSize: 22, fontWeight: "900", color: BRAND.colors.ink, marginTop: 6, marginBottom: 6 },
  subtitle: { fontSize: 13, color: BRAND.colors.graphite, lineHeight: 20 },
  error: { fontSize: 12, color: "#B91C1C", marginTop: 8 },
  statRow: { flexDirection: "row", gap: 8 },
  stat: {
    flex: 1,
    borderWidth: BRAND.borders.standard,
    borderColor: BRAND.colors.ink,
    padding: 10,
    alignItems: "center",
    backgroundColor: BRAND.colors.paper,
  },
  statHighlight: { backgroundColor: BRAND.colors.pink },
  statValue: { fontSize: 22, fontWeight: "900", color: BRAND.colors.ink },
  statValueHighlight: { color: BRAND.colors.paper },
  statLabel: {
    fontSize: 9,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontWeight: "700",
    color: BRAND.colors.graphite,
    marginTop: 2,
  },
  statLabelHighlight: { color: BRAND.colors.paper },
  card: {
    borderWidth: BRAND.borders.standard,
    borderColor: BRAND.colors.ink,
    backgroundColor: BRAND.colors.paper,
    padding: 14,
    gap: 8,
  },
  cardTitle: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: BRAND.colors.graphite,
    fontWeight: "700",
    marginBottom: 4,
  },
  action: {
    borderWidth: BRAND.borders.subtle,
    borderColor: BRAND.colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actionText: { fontSize: 14, fontWeight: "700", color: BRAND.colors.ink },
  actionArrow: { fontSize: 16, color: BRAND.colors.pink, fontWeight: "900" },
});
