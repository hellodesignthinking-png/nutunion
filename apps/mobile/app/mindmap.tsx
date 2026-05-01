import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { apiGet } from "@/lib/api";
import { BRAND } from "../../../packages/shared/brand-tokens";

/**
 * 모바일 마인드맵 미러 — 웹 reactflow 그래프의 리스트 변형.
 * RN 에서 SVG 그래프를 그리는 대신, kind 별 섹션으로 리스트화하고
 * 탭하면 해당 도메인 화면으로 이동.
 *
 * 데이터 출처: /api/dashboard/mindmap-data — 웹과 동일한 fetchMindMapData() 결과.
 */

interface MindMapData {
  nuts: Array<{ id: string; name: string; role: string }>;
  bolts: Array<{ id: string; title: string; status: string; daysLeft?: number }>;
  schedule: Array<{ id: string; title: string; at: string; source: "meeting" | "event" }>;
  issues: Array<{ id: string; title: string; kind: "overdue_task" | "mention" }>;
  washers: Array<{ id: string; nickname: string; nutIds: string[]; boltIds: string[] }>;
  topics: Array<{ id: string; name: string; groupId: string }>;
  files: Array<{ id: string; name: string; fileType?: string | null; projectId?: string | null }>;
}

type SectionKey = "schedule" | "issues" | "nuts" | "bolts" | "files" | "topics" | "washers";

const SECTION_META: Record<SectionKey, { label: string; icon: keyof typeof Feather.glyphMap; color: string }> = {
  schedule: { label: "다가오는 일정", icon: "calendar",       color: "#10B981" },
  issues:   { label: "처리 필요",     icon: "alert-triangle", color: "#EF4444" },
  nuts:     { label: "너트 (그룹)",   icon: "users",          color: BRAND.colors.pink },
  bolts:    { label: "볼트 (프로젝트)", icon: "box",          color: BRAND.colors.amber },
  files:    { label: "파일",          icon: "file",           color: "#78716C" },
  topics:   { label: "위키 탭",       icon: "book-open",      color: "#0EA5E9" },
  washers:  { label: "와셔 (동료)",   icon: "user",           color: "#7C3AED" },
};

export default function MindMapScreen() {
  const router = useRouter();
  const [data, setData] = useState<MindMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<SectionKey>>(new Set());

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const json = await apiGet<MindMapData>("/api/dashboard/mindmap-data");
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "로드 실패");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (key: SectionKey) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const total = data
    ? data.nuts.length + data.bolts.length + data.schedule.length + data.issues.length + data.topics.length + data.washers.length + data.files.length
    : 0;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "마인드맵 미러",
          headerStyle: { backgroundColor: BRAND.colors.paper },
          headerTitleStyle: {
            fontSize: 13,
            letterSpacing: 2,
            color: BRAND.colors.ink,
            fontWeight: "700",
            textTransform: "uppercase",
          },
        }}
      />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={BRAND.colors.pink} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>GENESIS · {total}개 노드</Text>
          <Text style={styles.title}>너의 생태계</Text>
          <Text style={styles.sub}>
            웹 마인드맵을 그대로 옮긴 리스트 미러. 탭하면 해당 도메인으로 이동.
          </Text>
        </View>

        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator color={BRAND.colors.pink} />
            <Text style={styles.loadingText}>마인드맵 불러오는 중…</Text>
          </View>
        )}
        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>⚠ {error}</Text>
          </View>
        )}

        {data && (
          <>
            <Section
              k="schedule"
              count={data.schedule.length}
              collapsed={collapsed.has("schedule")}
              onToggle={() => toggle("schedule")}
            >
              {data.schedule.map((s) => {
                const at = new Date(s.at);
                const hours = (at.getTime() - Date.now()) / (1000 * 60 * 60);
                return (
                  <Row
                    key={s.id}
                    title={s.title}
                    sub={`${at.toLocaleString("ko", { month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false })}  ·  ${formatHours(hours)}`}
                    badge={s.source === "meeting" ? "회의" : "이벤트"}
                    onPress={() => router.push("/(tabs)" as never)}
                  />
                );
              })}
              {data.schedule.length === 0 && <Empty text="7일 안에 예정된 일정 없음" />}
            </Section>

            <Section
              k="issues"
              count={data.issues.length}
              collapsed={collapsed.has("issues")}
              onToggle={() => toggle("issues")}
            >
              {data.issues.map((i) => (
                <Row
                  key={i.id}
                  title={i.title}
                  sub={i.kind === "overdue_task" ? "⏰ 마감 지남" : "💬 멘션 미확인"}
                  onPress={() => router.push("/(tabs)/approvals" as never)}
                />
              ))}
              {data.issues.length === 0 && <Empty text="처리할 이슈 없음 ✓" />}
            </Section>

            <Section
              k="nuts"
              count={data.nuts.length}
              collapsed={collapsed.has("nuts")}
              onToggle={() => toggle("nuts")}
            >
              {data.nuts.map((n) => (
                <Row
                  key={n.id}
                  title={n.name}
                  sub={n.role === "host" ? "👑 호스트" : n.role === "moderator" ? "🛠 운영" : "멤버"}
                  onPress={() => router.push("/(tabs)/nuts" as never)}
                />
              ))}
              {data.nuts.length === 0 && <Empty text="가입한 너트 없음" />}
            </Section>

            <Section
              k="bolts"
              count={data.bolts.length}
              collapsed={collapsed.has("bolts")}
              onToggle={() => toggle("bolts")}
            >
              {data.bolts.map((b) => (
                <Row
                  key={b.id}
                  title={b.title}
                  sub={b.daysLeft != null
                    ? (b.daysLeft >= 0 ? `D-${b.daysLeft}` : `${-b.daysLeft}일 지남`)
                    : b.status}
                  onPress={() => router.push("/(tabs)/bolts" as never)}
                />
              ))}
              {data.bolts.length === 0 && <Empty text="진행 중인 볼트 없음" />}
            </Section>

            <Section
              k="files"
              count={data.files.length}
              collapsed={collapsed.has("files")}
              onToggle={() => toggle("files")}
            >
              {data.files.map((f) => (
                <Row
                  key={f.id}
                  title={f.name}
                  sub={f.fileType ? `📎 ${f.fileType}` : "📎 파일"}
                  onPress={f.projectId ? () => router.push("/(tabs)/bolts" as never) : undefined}
                />
              ))}
              {data.files.length === 0 && <Empty text="첨부된 파일 없음" />}
            </Section>

            <Section
              k="topics"
              count={data.topics.length}
              collapsed={collapsed.has("topics")}
              onToggle={() => toggle("topics")}
            >
              {data.topics.map((t) => (
                <Row key={t.id} title={t.name} sub="📚 wiki 탭" />
              ))}
              {data.topics.length === 0 && <Empty text="위키 탭 없음" />}
            </Section>

            <Section
              k="washers"
              count={data.washers.length}
              collapsed={collapsed.has("washers")}
              onToggle={() => toggle("washers")}
            >
              {data.washers.map((w) => (
                <Row
                  key={w.id}
                  title={w.nickname}
                  sub={`🔗 ${w.nutIds.length + w.boltIds.length}개 공간 공유`}
                />
              ))}
              {data.washers.length === 0 && <Empty text="동료 없음" />}
            </Section>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatHours(h: number): string {
  if (h < 0) return `${Math.round(-h)}시간 지남`;
  if (h < 1) return "1시간 미만";
  if (h < 24) return `${Math.round(h)}시간 후`;
  return `${Math.round(h / 24)}일 후`;
}

function Section({
  k,
  count,
  collapsed,
  onToggle,
  children,
}: {
  k: SectionKey;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const meta = SECTION_META[k];
  return (
    <View style={styles.section}>
      <TouchableOpacity onPress={onToggle} style={styles.sectionHeader} activeOpacity={0.7}>
        <View style={[styles.sectionIcon, { backgroundColor: meta.color }]}>
          <Feather name={meta.icon} size={14} color={BRAND.colors.paper} />
        </View>
        <Text style={styles.sectionLabel}>{meta.label}</Text>
        <Text style={styles.sectionCount}>{count}</Text>
        <Feather
          name={collapsed ? "chevron-down" : "chevron-up"}
          size={16}
          color={BRAND.colors.graphite}
        />
      </TouchableOpacity>
      {!collapsed && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

function Row({
  title,
  sub,
  badge,
  onPress,
}: {
  title: string;
  sub?: string;
  badge?: string;
  onPress?: () => void;
}) {
  const Component: typeof TouchableOpacity | typeof View = onPress ? TouchableOpacity : View;
  return (
    <Component style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        {sub && <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text>}
      </View>
      {badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      {onPress && <Feather name="chevron-right" size={14} color={BRAND.colors.pink} />}
    </Component>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.emptyRow}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND.colors.paper },
  container: { padding: 16, gap: 12 },
  header: {
    borderWidth: BRAND.borders.strong,
    borderColor: BRAND.colors.ink,
    backgroundColor: BRAND.colors.paper,
    padding: 16,
  },
  kicker: { fontSize: 9, letterSpacing: 3, color: BRAND.colors.graphite, fontWeight: "700" },
  title: { fontSize: 22, fontWeight: "900", color: BRAND.colors.ink, marginTop: 4, marginBottom: 6 },
  sub: { fontSize: 12, color: BRAND.colors.graphite, lineHeight: 18 },
  loading: { padding: 24, alignItems: "center", gap: 8 },
  loadingText: { fontSize: 12, color: BRAND.colors.graphite },
  errorCard: {
    borderWidth: BRAND.borders.standard,
    borderColor: "#B91C1C",
    backgroundColor: "#FEE2E2",
    padding: 12,
  },
  errorText: { fontSize: 13, color: "#7F1D1D", fontWeight: "600" },
  section: {
    borderWidth: BRAND.borders.standard,
    borderColor: BRAND.colors.ink,
    backgroundColor: BRAND.colors.paper,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: BRAND.borders.subtle,
    borderBottomColor: BRAND.colors.ink,
  },
  sectionIcon: {
    width: 26,
    height: 26,
    borderWidth: BRAND.borders.subtle,
    borderColor: BRAND.colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    color: BRAND.colors.ink,
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 11,
    color: BRAND.colors.graphite,
    fontWeight: "700",
    marginRight: 4,
  },
  sectionBody: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(13,13,13,0.08)",
  },
  rowTitle: { fontSize: 14, fontWeight: "700", color: BRAND.colors.ink },
  rowSub: { fontSize: 11, color: BRAND.colors.graphite, marginTop: 2 },
  badge: {
    borderWidth: BRAND.borders.subtle,
    borderColor: BRAND.colors.ink,
    backgroundColor: BRAND.colors.paper,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: BRAND.colors.ink,
    letterSpacing: 1,
  },
  emptyRow: {
    paddingVertical: 14,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 12,
    color: BRAND.colors.graphite,
    fontStyle: "italic",
  },
});
