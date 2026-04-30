import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiPost } from "@/lib/api";
import { BRAND } from "../../../../packages/shared/brand-tokens";

interface Msg {
  id: string;
  role: "user" | "assistant";
  text: string;
  actions?: { label: string }[];
}

const QUICK_PROMPTS = [
  "오늘 일정 요약해줘",
  "이번 주 밀린 일",
  "최근 결재 알려줘",
  "지금 진행 중인 볼트",
];

export default function AIChatScreen() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<FlatList<Msg>>(null);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      const userMsg: Msg = {
        id: `u-${Date.now()}`,
        role: "user",
        text: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setBusy(true);
      try {
        const res = await apiPost<{ reply?: string; message?: string; actions?: { label: string }[] }>(
          "/api/dashboard/ai-agent",
          { message: trimmed }
        );
        const replyText = res.reply ?? res.message ?? "(응답 없음)";
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: replyText,
            actions: res.actions ?? [],
          },
        ]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "요청 실패";
        setMessages((prev) => [
          ...prev,
          { id: `e-${Date.now()}`, role: "assistant", text: `⚠ ${msg}` },
        ]);
      } finally {
        setBusy(false);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
      }
    },
    [busy]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={64}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.kicker}>AI 작전봉</Text>
              <Text style={styles.emptyTitle}>무엇을 도와드릴까요?</Text>
              <Text style={styles.emptyBody}>
                일정·할일·결재·볼트에 대해 자연어로 물어보세요.
              </Text>
              <View style={styles.chips}>
                {QUICK_PROMPTS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={styles.chip}
                    onPress={() => send(p)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.chipText}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === "user" ? styles.bubbleUser : styles.bubbleAssistant,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  item.role === "user" && { color: BRAND.colors.paper },
                ]}
              >
                {item.text}
              </Text>
              {item.actions && item.actions.length > 0 && (
                <View style={styles.actionRow}>
                  {item.actions.map((a, i) => (
                    <View key={i} style={styles.actionBadge}>
                      <Text style={styles.actionBadgeText}>{a.label}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        />

        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="메시지를 입력하세요"
            placeholderTextColor={BRAND.colors.graphite}
            style={styles.input}
            multiline
            editable={!busy}
            onSubmitEditing={() => send(input)}
          />
          <TouchableOpacity
            style={[styles.sendBtn, busy && { opacity: 0.5 }]}
            onPress={() => send(input)}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={BRAND.colors.paper} />
            ) : (
              <Text style={styles.sendText}>전송</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND.colors.paper },
  flex: { flex: 1 },
  list: { padding: 16, gap: 10, flexGrow: 1 },
  emptyWrap: { padding: 16, gap: 12 },
  kicker: { fontSize: 10, letterSpacing: 4, color: BRAND.colors.graphite, fontWeight: "700" },
  emptyTitle: { fontSize: 24, fontWeight: "900", color: BRAND.colors.ink },
  emptyBody: { fontSize: 13, color: BRAND.colors.graphite, lineHeight: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: {
    borderWidth: BRAND.borders.standard,
    borderColor: BRAND.colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: BRAND.colors.paper,
  },
  chipText: { fontSize: 12, fontWeight: "700", color: BRAND.colors.ink },
  bubble: {
    borderWidth: BRAND.borders.standard,
    borderColor: BRAND.colors.ink,
    padding: 12,
    maxWidth: "85%",
  },
  bubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: BRAND.colors.ink,
  },
  bubbleAssistant: {
    alignSelf: "flex-start",
    backgroundColor: BRAND.colors.paper,
  },
  bubbleText: { fontSize: 14, color: BRAND.colors.ink, lineHeight: 20 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  actionBadge: {
    borderWidth: 1.5,
    borderColor: BRAND.colors.ink,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: BRAND.colors.amber,
  },
  actionBadgeText: { fontSize: 10, fontWeight: "700", color: BRAND.colors.ink, letterSpacing: 1 },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderTopWidth: BRAND.borders.standard,
    borderTopColor: BRAND.colors.ink,
    backgroundColor: BRAND.colors.paper,
  },
  input: {
    flex: 1,
    borderWidth: BRAND.borders.standard,
    borderColor: BRAND.colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: BRAND.colors.ink,
    backgroundColor: BRAND.colors.paper,
    maxHeight: 100,
  },
  sendBtn: {
    borderWidth: BRAND.borders.standard,
    borderColor: BRAND.colors.ink,
    backgroundColor: BRAND.colors.pink,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  sendText: {
    color: BRAND.colors.paper,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
});
