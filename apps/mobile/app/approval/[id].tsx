import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { mutateWithQueue } from "@/lib/sync/sync-engine";
import { BRAND } from "../../../../packages/shared/brand-tokens";

interface Approval {
  id: number | string;
  title: string;
  doc_type: string | null;
  content: string | null;
  amount: number | null;
  status: string | null;
  request_date: string | null;
  requester_name: string | null;
  approver_name: string | null;
  reject_reason: string | null;
  company: string | null;
}

export default function ApprovalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [approval, setApproval] = useState<Approval | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("approvals").select("*").eq("id", id).maybeSingle();
    setApproval((data as Approval) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    if (!id) return;
    load();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      setRole((p?.role as string) ?? null);
    });
  }, [id]);

  const isAdminStaff = role === "admin" || role === "staff";
  const isPending = approval?.status === "대기";

  async function doAction(action: "approve" | "reject" | "cancel") {
    if (!approval) return;
    setActing(true);
    try {
      const res = await mutateWithQueue({
        endpoint: `/api/finance/approvals/${approval.id}`,
        method: "POST",
        body: {
          action,
          ...(action === "reject" ? { reject_reason: rejectReason.trim() || undefined } : {}),
        },
      });
      if (res.queued) {
        Alert.alert("오프라인", "네트워크 복귀 시 자동 처리됩니다");
      } else if (res.error) {
        Alert.alert("오류", res.error);
        return;
      } else {
        Alert.alert("완료", action === "approve" ? "승인됨" : action === "reject" ? "반려됨" : "취소됨");
      }
      await load();
      setShowRejectInput(false);
      setRejectReason("");
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={BRAND.colors.pink} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }
  if (!approval) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.empty}>결재를 찾을 수 없습니다</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={{ title: approval.title }} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.kicker}>{approval.doc_type ?? "-"}</Text>
          <Text style={styles.title}>{approval.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>상태</Text>
            <Text style={styles.metaValue}>{approval.status}</Text>
          </View>
          {approval.amount != null && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>금액</Text>
              <Text style={[styles.metaValue, styles.amount]}>₩{approval.amount.toLocaleString("ko-KR")}</Text>
            </View>
          )}
          {approval.requester_name && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>요청자</Text>
              <Text style={styles.metaValue}>{approval.requester_name}</Text>
            </View>
          )}
          {approval.approver_name && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{approval.status === "반려" ? "반려자" : "승인자"}</Text>
              <Text style={styles.metaValue}>{approval.approver_name}</Text>
            </View>
          )}
        </View>

        {approval.content && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>내용</Text>
            <Text style={styles.body}>{approval.content}</Text>
          </View>
        )}

        {approval.reject_reason && (
          <View style={[styles.card, { borderColor: "#DC2626" }]}>
            <Text style={[styles.sectionLabel, { color: "#DC2626" }]}>반려 사유</Text>
            <Text style={[styles.body, { color: "#B91C1C" }]}>{approval.reject_reason}</Text>
          </View>
        )}

        {isPending && isAdminStaff && (
          <>
            {showRejectInput && (
              <View style={styles.card}>
                <Text style={styles.sectionLabel}>반려 사유 (선택)</Text>
                <TextInput
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                  placeholder="반려 사유를 입력하세요"
                  placeholderTextColor={BRAND.colors.graphite}
                  style={styles.textArea}
                />
              </View>
            )}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnApprove, acting && { opacity: 0.5 }]}
                onPress={() => doAction("approve")}
                disabled={acting}
              >
                <Text style={[styles.btnText, { color: BRAND.colors.paper }]}>승인</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnReject, acting && { opacity: 0.5 }]}
                onPress={() => (showRejectInput ? doAction("reject") : setShowRejectInput(true))}
                disabled={acting}
              >
                <Text style={[styles.btnText, { color: "#B91C1C" }]}>
                  {showRejectInput ? "반려 확정" : "반려"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
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
  kicker: { fontSize: 10, letterSpacing: 3, color: BRAND.colors.graphite, fontWeight: "700", textTransform: "uppercase" },
  title: { fontSize: 20, fontWeight: "900", color: BRAND.colors.ink, marginVertical: 8 },
  metaRow: { flexDirection: "row", paddingVertical: 6, borderTopWidth: 1, borderTopColor: "rgba(13,13,13,0.1)" },
  metaLabel: { width: 70, fontSize: 11, letterSpacing: 1, color: BRAND.colors.graphite, textTransform: "uppercase", fontWeight: "600" },
  metaValue: { flex: 1, fontSize: 13, color: BRAND.colors.ink, fontWeight: "600" },
  amount: { fontSize: 16, fontWeight: "900" },
  sectionLabel: { fontSize: 10, letterSpacing: 2, color: BRAND.colors.graphite, textTransform: "uppercase", fontWeight: "700", marginBottom: 8 },
  body: { fontSize: 13, color: BRAND.colors.ink, lineHeight: 20 },
  textArea: {
    borderWidth: 1.5,
    borderColor: BRAND.colors.ink,
    padding: 10,
    fontSize: 13,
    minHeight: 80,
    color: BRAND.colors.ink,
    textAlignVertical: "top",
  },
  actions: { flexDirection: "row", gap: 8 },
  btn: {
    flex: 1,
    borderWidth: BRAND.borders.standard,
    padding: 14,
    alignItems: "center",
  },
  btnApprove: {
    backgroundColor: BRAND.colors.pink,
    borderColor: BRAND.colors.ink,
  },
  btnReject: {
    backgroundColor: BRAND.colors.paper,
    borderColor: "#DC2626",
  },
  btnText: { fontSize: 12, letterSpacing: 3, fontWeight: "800", textTransform: "uppercase" },
});
