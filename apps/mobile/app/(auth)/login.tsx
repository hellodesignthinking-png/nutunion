import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { supabase } from "@/lib/supabase";
import { BRAND } from "../../../../packages/shared/brand-tokens";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
    if (!email.trim()) return Alert.alert("이메일을 입력하세요");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
      if (error) throw error;
      setSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "발송 실패";
      Alert.alert("오류", msg);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) return Alert.alert("코드를 입력하세요");
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: "email",
      });
      if (error) throw error;
      // _layout 의 onAuthStateChange 가 자동 라우팅
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "인증 실패";
      Alert.alert("오류", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.kicker}>NUTUNION</Text>
        <Text style={styles.title}>로그인</Text>
        <Text style={styles.subtitle}>이메일로 1회용 코드를 받습니다.</Text>

        <Text style={styles.label}>이메일</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          editable={!sent}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="you@example.com"
          placeholderTextColor={BRAND.colors.graphite}
          style={styles.input}
        />

        {sent && (
          <>
            <Text style={styles.label}>6자리 코드</Text>
            <TextInput
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="000000"
              placeholderTextColor={BRAND.colors.graphite}
              style={styles.input}
            />
          </>
        )}

        <TouchableOpacity
          onPress={sent ? verifyOtp : sendOtp}
          disabled={loading}
          style={[styles.button, loading && { opacity: 0.5 }]}
        >
          {loading ? (
            <ActivityIndicator color={BRAND.colors.paper} />
          ) : (
            <Text style={styles.buttonText}>{sent ? "인증" : "코드 받기"}</Text>
          )}
        </TouchableOpacity>

        {sent && (
          <TouchableOpacity
            onPress={() => {
              setSent(false);
              setOtp("");
            }}
            style={styles.linkButton}
          >
            <Text style={styles.linkText}>이메일 변경</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.colors.paper,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    borderWidth: BRAND.borders.standard,
    borderColor: BRAND.colors.ink,
    backgroundColor: BRAND.colors.paper,
    padding: 24,
    gap: 12,
  },
  kicker: {
    fontSize: 10,
    letterSpacing: 4,
    color: BRAND.colors.graphite,
    fontWeight: "600",
  },
  title: { fontSize: 28, fontWeight: "800", color: BRAND.colors.ink, marginBottom: 4 },
  subtitle: { fontSize: 13, color: BRAND.colors.graphite, marginBottom: 8 },
  label: {
    fontSize: 10,
    letterSpacing: 2,
    color: BRAND.colors.graphite,
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 6,
    fontWeight: "600",
  },
  input: {
    borderWidth: BRAND.borders.standard,
    borderColor: BRAND.colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: BRAND.colors.ink,
    backgroundColor: BRAND.colors.paper,
  },
  button: {
    marginTop: 16,
    backgroundColor: BRAND.colors.pink,
    borderWidth: BRAND.borders.standard,
    borderColor: BRAND.colors.ink,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: BRAND.colors.paper,
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  linkButton: { marginTop: 12, alignItems: "center" },
  linkText: { fontSize: 12, color: BRAND.colors.graphite, textDecorationLine: "underline" },
});
