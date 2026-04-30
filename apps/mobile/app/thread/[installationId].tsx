// 설치된 Thread 의 모바일 뷰어.
// /api/threads/installations/:id 에서 spec 을 받아 GenericThread 에 전달.

import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, Stack } from "expo-router";
import { apiGet } from "@/lib/api";
import { GenericThread, type ThreadSpec } from "@/components/threads/generic-thread";
import { BRAND } from "../../../../packages/shared/brand-tokens";

interface InstallationResponse {
  installation?: {
    id: string;
    name?: string;
    spec?: ThreadSpec;
  };
  spec?: ThreadSpec;
  name?: string;
}

export default function ThreadViewer() {
  const { installationId } = useLocalSearchParams<{ installationId: string }>();
  const [spec, setSpec] = useState<ThreadSpec | null>(null);
  const [title, setTitle] = useState<string>("Thread");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!installationId) return;
    let alive = true;
    (async () => {
      try {
        const json = await apiGet<InstallationResponse>(
          `/api/threads/installations/${installationId}`
        );
        if (!alive) return;
        const resolved =
          json.installation?.spec ?? json.spec ?? null;
        setSpec(resolved);
        setTitle(json.installation?.name ?? json.name ?? "Thread");
      } catch (err: unknown) {
        if (alive) setError(err instanceof Error ? err.message : "로드 실패");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [installationId]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={{ title, headerShown: true }} />
      {loading ? (
        <ActivityIndicator color={BRAND.colors.pink} style={{ marginTop: 32 }} />
      ) : error || !spec ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>⚠ {error ?? "Thread 사양을 불러올 수 없습니다"}</Text>
        </View>
      ) : (
        <GenericThread installationId={String(installationId)} spec={spec} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND.colors.paper },
  errorWrap: { padding: 24, alignItems: "center" },
  errorText: { color: "#B91C1C", fontSize: 14 },
});
