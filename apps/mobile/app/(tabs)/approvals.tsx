import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useApprovals } from "@/lib/sync/use-synced-data";
import { OfflineBanner } from "@/components/offline-banner";
import { BRAND } from "../../../../packages/shared/brand-tokens";

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  "대기":   { bg: "#FFF4E0", fg: "#B45309" },
  "승인":   { bg: "#DCFCE7", fg: "#15803D" },
  "반려":   { bg: "#FEE2E2", fg: "#B91C1C" },
};

export default function ApprovalsScreen() {
  const { data, loading, refreshing, fromCache, refresh } = useApprovals();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <OfflineBanner />
      <FlatList
        data={data}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={BRAND.colors.pink} />
        }
        ListHeaderComponent={
          fromCache ? (
            <Text style={styles.cacheNote}>캐시 데이터 — 네트워크 복귀 시 자동 갱신</Text>
          ) : null
        }
        ListEmptyComponent={!loading ? <Text style={styles.empty}>결재 없음</Text> : null}
        renderItem={({ item }) => {
          const c = STATUS_COLOR[item.status ?? ""] ?? { bg: BRAND.colors.paper, fg: BRAND.colors.graphite };
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/approval/${item.id}` as never)}
              activeOpacity={0.7}
            >
              <View style={styles.row}>
                <View style={[styles.statusBadge, { backgroundColor: c.bg }]}>
                  <Text style={[styles.statusText, { color: c.fg }]}>{item.status ?? "-"}</Text>
                </View>
                {item.doc_type && <Text style={styles.docType}>{item.doc_type}</Text>}
              </View>
              <Text style={styles.title}>{item.title}</Text>
              {item.amount != null && (
                <Text style={styles.amount}>₩{item.amount.toLocaleString("ko-KR")}</Text>
              )}
              {item.created_at && (
                <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString("ko-KR")}</Text>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND.colors.paper },
  list: { padding: 16, gap: 12 },
  cacheNote: {
    fontSize: 10,
    color: BRAND.colors.graphite,
    letterSpacing: 1,
    textAlign: "center",
    marginBottom: 4,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  card: {
    borderWidth: BRAND.borders.standard,
    borderColor: BRAND.colors.ink,
    backgroundColor: BRAND.colors.paper,
    padding: 14,
  },
  row: { flexDirection: "row", gap: 8, marginBottom: 8, alignItems: "center" },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1.5,
    borderColor: BRAND.colors.ink,
  },
  statusText: {
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  docType: {
    fontSize: 10,
    letterSpacing: 1,
    color: BRAND.colors.graphite,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  title: { fontSize: 15, fontWeight: "800", color: BRAND.colors.ink, marginBottom: 4 },
  amount: { fontSize: 13, color: BRAND.colors.ink, fontWeight: "700", marginBottom: 4 },
  date: { fontSize: 11, color: BRAND.colors.graphite },
  empty: { textAlign: "center", marginTop: 40, color: BRAND.colors.graphite, fontSize: 13 },
});
