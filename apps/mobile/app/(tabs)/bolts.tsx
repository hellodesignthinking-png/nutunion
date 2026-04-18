import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { BRAND } from "../../../../packages/shared/brand-tokens";

interface Bolt {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  category: string | null;
  created_at: string;
}

export default function BoltsScreen() {
  const [bolts, setBolts] = useState<Bolt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("projects")
      .select("id, title, description, status, category, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setBolts((data as Bolt[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        data={bolts}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={BRAND.colors.pink} />
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>아직 볼트가 없습니다</Text>
          ) : null
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
  card: {
    borderWidth: BRAND.borders.standard,
    borderColor: BRAND.colors.ink,
    backgroundColor: BRAND.colors.paper,
    padding: 16,
  },
  cardHeader: { flexDirection: "row", gap: 8, marginBottom: 8 },
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
  title: { fontSize: 16, fontWeight: "800", color: BRAND.colors.ink, marginBottom: 4 },
  desc: { fontSize: 13, color: BRAND.colors.graphite, lineHeight: 18 },
  empty: { textAlign: "center", marginTop: 40, color: BRAND.colors.graphite, fontSize: 13 },
});
