import { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { BRAND } from "../../../../packages/shared/brand-tokens";

interface Group {
  id: string;
  name: string;
  description: string | null;
}

export default function NutsScreen() {
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    supabase
      .from("groups")
      .select("id, name, description")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setGroups((data as Group[]) ?? []));
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        data={groups}
        keyExtractor={(g) => g.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.name}</Text>
            {item.description && <Text style={styles.desc}>{item.description}</Text>}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>그룹 없음</Text>}
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
  title: { fontSize: 16, fontWeight: "800", color: BRAND.colors.ink, marginBottom: 4 },
  desc: { fontSize: 13, color: BRAND.colors.graphite, lineHeight: 18 },
  empty: { textAlign: "center", marginTop: 40, color: BRAND.colors.graphite, fontSize: 13 },
});
