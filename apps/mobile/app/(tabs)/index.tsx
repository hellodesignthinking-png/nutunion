import { View, Text, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BRAND } from "../../../../packages/shared/brand-tokens";

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.kicker}>NUTUNION</Text>
          <Text style={styles.hero}>Protocol Collective</Text>
          <Text style={styles.subtitle}>
            공간, 문화, 플랫폼, 바이브를 잇는 시티체인저 연합체
          </Text>
        </View>

        <Section title="오늘의 활동" placeholder="로드 중..." />
        <Section title="진행 중 볼트" placeholder="로드 중..." />
        <Section title="알림" placeholder="최근 알림 없음" />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, placeholder }: { title: string; placeholder: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{placeholder}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND.colors.paper },
  container: { padding: 16, gap: 12 },
  heroCard: {
    borderWidth: BRAND.borders.strong,
    borderColor: BRAND.colors.ink,
    backgroundColor: BRAND.colors.paper,
    padding: 20,
    marginBottom: 8,
  },
  kicker: { fontSize: 10, letterSpacing: 4, color: BRAND.colors.graphite, fontWeight: "700" },
  hero: { fontSize: 24, fontWeight: "900", color: BRAND.colors.ink, marginTop: 6, marginBottom: 6 },
  subtitle: { fontSize: 13, color: BRAND.colors.graphite, lineHeight: 20 },
  card: {
    borderWidth: BRAND.borders.standard,
    borderColor: BRAND.colors.ink,
    backgroundColor: BRAND.colors.paper,
    padding: 14,
  },
  cardTitle: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: BRAND.colors.graphite,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardBody: { fontSize: 13, color: BRAND.colors.ink },
});
