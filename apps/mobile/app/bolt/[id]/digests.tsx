import { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, RefreshControl, FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { apiPost } from "@/lib/api";
import { BRAND } from "../../../../../packages/shared/brand-tokens";

interface Digest {
  id: string;
  title: string;
  summary: string;
  chat_date: string | null;
  source: string;
  topics: { title: string; summary: string }[];
  decisions: string[];
  action_items: { assignee: string | null; task: string; due: string | null }[];
  participants: string[];
  created_at: string;
}

export default function BoltDigestsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [items, setItems] = useState<Digest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("chat_digests")
      .select("*")
      .eq("entity_type", "project")
      .eq("entity_id", id)
      .order("created_at", { ascending: false });
    setItems((data as Digest[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "회의록",
          headerRight: () => (
            <TouchableOpacity onPress={() => setModalOpen(true)} style={{ paddingRight: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: "800", letterSpacing: 1.5, color: BRAND.colors.pink }}>
                + 정리
              </Text>
            </TouchableOpacity>
          ),
        }}
      />
      <FlatList
        data={items}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={BRAND.colors.pink} />
        }
        ListEmptyComponent={!loading ? <Text style={styles.empty}>회의록 없음</Text> : null}
        renderItem={({ item }) => <DigestCard digest={item} />}
      />

      <CreateModal
        visible={modalOpen}
        projectId={id!}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); load(); }}
      />
    </SafeAreaView>
  );
}

function DigestCard({ digest }: { digest: Digest }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={() => setOpen(!open)} activeOpacity={0.7}>
        <View style={styles.rowBetween}>
          <Text style={styles.meta}>
            {digest.source.toUpperCase()} · {digest.chat_date ?? "날짜미상"} · {digest.participants.length}명
          </Text>
          <Text style={styles.chevron}>{open ? "▲" : "▼"}</Text>
        </View>
        <Text style={styles.title}>{digest.title}</Text>
        <Text style={styles.summary} numberOfLines={open ? undefined : 3}>
          {digest.summary}
        </Text>
      </TouchableOpacity>

      {open && (
        <View style={styles.expanded}>
          {digest.topics.length > 0 && (
            <Section label="주요 논의">
              {digest.topics.map((t, i) => (
                <View key={i} style={{ marginBottom: 8 }}>
                  <Text style={styles.topicTitle}>{i + 1}. {t.title}</Text>
                  <Text style={styles.topicBody}>{t.summary}</Text>
                </View>
              ))}
            </Section>
          )}
          {digest.decisions.length > 0 && (
            <Section label="결정 사항">
              {digest.decisions.map((d, i) => (
                <Text key={i} style={styles.listItem}>· {d}</Text>
              ))}
            </Section>
          )}
          {digest.action_items.length > 0 && (
            <Section label="실행 항목">
              {digest.action_items.map((a, i) => (
                <Text key={i} style={styles.listItem}>
                  · {a.assignee ? `${a.assignee}: ` : ""}{a.task}
                  {a.due ? `  ~${a.due}` : ""}
                </Text>
              ))}
            </Section>
          )}
        </View>
      )}
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function CreateModal({ visible, projectId, onClose, onSuccess }: {
  visible: boolean; projectId: string; onClose: () => void; onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [chat, setChat] = useState("");
  const [chatDate, setChatDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!title.trim() || chat.trim().length < 20) {
      return Alert.alert("입력", "제목과 대화 내용(20자 이상)을 입력하세요");
    }
    setLoading(true);
    try {
      await apiPost("/api/chat-digest", {
        entity_type: "project",
        entity_id: projectId,
        title: title.trim(),
        chat,
        chat_date: chatDate,
        source: "kakao",
      });
      Alert.alert("완료", "회의록 생성됨");
      setTitle(""); setChat("");
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "실패";
      Alert.alert("오류", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.modalCancel}>취소</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>카톡 회의록 정리</Text>
          <TouchableOpacity onPress={submit} disabled={loading}>
            <Text style={[styles.modalSubmit, loading && { opacity: 0.5 }]}>
              {loading ? "..." : "생성"}
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalBody}>
          <Text style={styles.fieldLabel}>제목</Text>
          <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="2026-04-18 주간 회의" placeholderTextColor={BRAND.colors.graphite} />
          <Text style={styles.fieldLabel}>대화 일자</Text>
          <TextInput value={chatDate} onChangeText={setChatDate} style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={BRAND.colors.graphite} />
          <Text style={styles.fieldLabel}>대화 내용</Text>
          <TextInput
            value={chat}
            onChangeText={setChat}
            multiline
            numberOfLines={12}
            style={[styles.input, styles.textArea]}
            placeholder="카카오톡 → 대화 내보내기 결과 붙여넣기"
            placeholderTextColor={BRAND.colors.graphite}
          />
          <Text style={styles.hint}>AI 가 요약/결정사항/실행항목을 자동 추출합니다 (5~15초)</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND.colors.paper },
  list: { padding: 16, gap: 12 },
  empty: { textAlign: "center", marginTop: 40, color: BRAND.colors.graphite, fontSize: 13 },
  card: { borderWidth: BRAND.borders.standard, borderColor: BRAND.colors.ink, backgroundColor: BRAND.colors.paper, padding: 14 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  meta: { fontSize: 10, letterSpacing: 1, color: BRAND.colors.graphite, fontWeight: "600", textTransform: "uppercase" },
  chevron: { fontSize: 12, color: BRAND.colors.graphite },
  title: { fontSize: 15, fontWeight: "800", color: BRAND.colors.ink, marginVertical: 6 },
  summary: { fontSize: 13, color: BRAND.colors.ink, lineHeight: 19 },
  expanded: { borderTopWidth: 1, borderTopColor: "rgba(13,13,13,0.1)", marginTop: 10, paddingTop: 10 },
  sectionLabel: { fontSize: 10, letterSpacing: 2, color: BRAND.colors.graphite, textTransform: "uppercase", fontWeight: "700", marginBottom: 6 },
  topicTitle: { fontSize: 13, fontWeight: "700", color: BRAND.colors.ink },
  topicBody: { fontSize: 12, color: BRAND.colors.graphite, marginTop: 2, lineHeight: 18 },
  listItem: { fontSize: 13, color: BRAND.colors.ink, marginBottom: 4 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: BRAND.borders.standard,
    borderBottomColor: BRAND.colors.ink,
  },
  modalCancel: { fontSize: 14, color: BRAND.colors.graphite, fontWeight: "600" },
  modalTitle: { fontSize: 13, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase" },
  modalSubmit: { fontSize: 14, color: BRAND.colors.pink, fontWeight: "900", letterSpacing: 1 },
  modalBody: { padding: 16, gap: 4, paddingBottom: 32 },
  fieldLabel: { fontSize: 10, letterSpacing: 2, color: BRAND.colors.graphite, textTransform: "uppercase", fontWeight: "700", marginTop: 10 },
  input: {
    borderWidth: BRAND.borders.standard,
    borderColor: BRAND.colors.ink,
    padding: 10,
    fontSize: 14,
    color: BRAND.colors.ink,
    backgroundColor: BRAND.colors.paper,
    marginTop: 4,
  },
  textArea: { minHeight: 220, textAlignVertical: "top", fontFamily: "Courier", fontSize: 12 },
  hint: { fontSize: 11, color: BRAND.colors.graphite, marginTop: 6 },
});
