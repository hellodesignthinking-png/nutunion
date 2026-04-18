import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { BRAND } from "../../../../packages/shared/brand-tokens";

interface Bolt {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  category: string | null;
  closure_summary: string | null;
  closed_at: string | null;
}

export default function BoltDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [bolt, setBolt] = useState<Bolt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("projects")
      .select("id, title, description, status, category, closure_summary, closed_at")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        setBolt((data as Bolt) ?? null);
        setLoading(false);
      });
  }, [id]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={{ title: bolt?.title ?? "볼트" }} />
      {loading ? (
        <ActivityIndicator color={BRAND.colors.pink} style={{ marginTop: 40 }} />
      ) : !bolt ? (
        <Text style={styles.empty}>볼트를 찾을 수 없습니다</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.card}>
            <View style={styles.meta}>
              <Text style={styles.status}>{bolt.status ?? "-"}</Text>
              {bolt.category && <Text style={styles.category}>{bolt.category}</Text>}
            </View>
            <Text style={styles.title}>{bolt.title}</Text>
            {bolt.description && <Text style={styles.desc}>{bolt.description}</Text>}
          </View>

          {bolt.closure_summary && (
            <View style={styles.closureCard}>
              <Text style={styles.closureBadge}>🏁 CLOSED</Text>
              {bolt.closed_at && (
                <Text style={styles.closureDate}>
                  {new Date(bolt.closed_at).toLocaleDateString("ko-KR")} 마감
                </Text>
              )}
              <Text style={styles.closureSummary}>{bolt.closure_summary}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND.colors.paper },
  container: { padding: 16, gap: 12 },
  empty: { textAlign: "center", marginTop: 40, color: BRAND.colors.graphite },
  card: {
    borderWidth: BRAND.borders.standard,
    borderColor: BRAND.colors.ink,
    backgroundColor: BRAND.colors.paper,
    padding: 16,
  },
  meta: { flexDirection: "row", gap: 8, marginBottom: 10 },
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
  title: { fontSize: 22, fontWeight: "900", color: BRAND.colors.ink, marginBottom: 8 },
  desc: { fontSize: 14, color: BRAND.colors.ink, lineHeight: 21 },
  closureCard: {
    borderWidth: BRAND.borders.strong,
    borderColor: BRAND.colors.ink,
    backgroundColor: "#FFF5F9",
    padding: 16,
  },
  closureBadge: {
    fontSize: 10,
    letterSpacing: 3,
    color: BRAND.colors.paper,
    backgroundColor: BRAND.colors.ink,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    fontWeight: "700",
    marginBottom: 8,
  },
  closureDate: { fontSize: 11, color: BRAND.colors.graphite, marginBottom: 10 },
  closureSummary: { fontSize: 14, color: BRAND.colors.ink, lineHeight: 21 },
});
