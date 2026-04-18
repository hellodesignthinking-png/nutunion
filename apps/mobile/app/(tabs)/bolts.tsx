import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useBolts } from "@/lib/sync/use-synced-data";
import { OfflineBanner } from "@/components/offline-banner";
import { BRAND } from "../../../../packages/shared/brand-tokens";

export default function BoltsScreen() {
  const { data, loading, refreshing, fromCache, refresh } = useBolts();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <OfflineBanner />
      <FlatList
        data={data}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => refresh(true)} tintColor={BRAND.colors.pink} />
        }
        ListHeaderComponent={
          fromCache ? (
            <Text style={styles.cacheNote}>캐시 데이터 — 네트워크 복귀 시 자동 갱신</Text>
          ) : null
        }
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>아직 볼트가 없습니다</Text> : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/bolt/${item.id}` as never)}
            activeOpacity={0.7}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.status}>{item.status ?? "-"}</Text>
              {item.category && <Text style={styles.category}>{item.category}</Text>}
              {item.closed_at && <Text style={styles.closedTag}>🏁 CLOSED</Text>}
            </View>
            <Text style={styles.title}>{item.title}</Text>
            {item.description && (
              <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
            )}
          </TouchableOpacity>
        )}
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
    padding: 16,
  },
  cardHeader: { flexDirection: "row", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  status: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: BRAND.colors.paper,
    backgroundColor: BRAND.colors.ink,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontWeight: "700",
  },
  category: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: BRAND.colors.graphite,
    borderWidth: 1.5,
    borderColor: BRAND.colors.ink,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  closedTag: {
    fontSize: 9,
    letterSpacing: 2,
    color: BRAND.colors.pink,
    fontWeight: "800",
    paddingVertical: 2,
  },
  title: { fontSize: 16, fontWeight: "800", color: BRAND.colors.ink, marginBottom: 4 },
  desc: { fontSize: 13, color: BRAND.colors.graphite, lineHeight: 18 },
  empty: { textAlign: "center", marginTop: 40, color: BRAND.colors.graphite, fontSize: 13 },
});
