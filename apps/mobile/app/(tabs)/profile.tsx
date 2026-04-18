import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { usePushNotifications } from "@/lib/use-push-notifications";
import { BRAND } from "../../../../packages/shared/brand-tokens";

interface Profile {
  id: string;
  nickname: string | null;
  email: string | null;
  role: string | null;
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const { expoPushToken, registered } = usePushNotifications();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("id, nickname, email, role")
        .eq("id", user.id)
        .maybeSingle();
      setProfile((data as Profile) ?? null);
    });
  }, []);

  const signOut = async () => {
    Alert.alert("로그아웃", "정말 로그아웃하시겠어요?", [
      { text: "취소", style: "cancel" },
      { text: "로그아웃", style: "destructive", onPress: () => supabase.auth.signOut() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.kicker}>PROFILE</Text>
          <Text style={styles.name}>{profile?.nickname ?? "(프로필 없음)"}</Text>
          <Text style={styles.email}>{profile?.email ?? "-"}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{profile?.role ?? "member"}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>푸시 알림</Text>
          <Text style={styles.sectionBody}>
            {registered ? "✓ 구독 중" : "미구독"}
          </Text>
          {expoPushToken && (
            <Text style={styles.tokenText}>
              Token: {expoPushToken.slice(0, 20)}…
            </Text>
          )}
        </View>

        <TouchableOpacity onPress={signOut} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>로그아웃</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND.colors.paper },
  container: { padding: 16, gap: 12 },
  card: {
    borderWidth: BRAND.borders.standard,
    borderColor: BRAND.colors.ink,
    backgroundColor: BRAND.colors.paper,
    padding: 16,
  },
  kicker: { fontSize: 10, letterSpacing: 4, color: BRAND.colors.graphite, fontWeight: "700" },
  name: { fontSize: 22, fontWeight: "900", color: BRAND.colors.ink, marginTop: 6 },
  email: { fontSize: 13, color: BRAND.colors.graphite, marginTop: 4 },
  roleBadge: {
    alignSelf: "flex-start",
    marginTop: 10,
    backgroundColor: BRAND.colors.ink,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  roleText: {
    fontSize: 9,
    letterSpacing: 2,
    color: BRAND.colors.paper,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  sectionTitle: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: BRAND.colors.graphite,
    fontWeight: "700",
    marginBottom: 6,
  },
  sectionBody: { fontSize: 14, color: BRAND.colors.ink },
  tokenText: {
    marginTop: 8,
    fontSize: 10,
    color: BRAND.colors.graphite,
    fontFamily: "Courier",
  },
  signOutBtn: {
    borderWidth: BRAND.borders.standard,
    borderColor: "#DC2626",
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  signOutText: {
    color: "#DC2626",
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});
