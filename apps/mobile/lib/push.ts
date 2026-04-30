// 간단한 Expo Push 등록 헬퍼.
// 이미 use-push-notifications 훅이 라이프사이클 관리를 담당하지만,
// 일회성/스크립트 등록이 필요한 곳을 위한 함수형 API.

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { supabase } from "./supabase";
import { apiPost } from "./api";

/**
 * 알림 권한 요청 + Expo Push Token 획득.
 * 시뮬레이터/권한거부 시 null.
 */
export async function registerForPush(): Promise<string | null> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let final = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    final = status;
  }
  if (final !== "granted") return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants.expoConfig as { projectId?: string } | undefined)?.projectId;

  try {
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return token.data;
  } catch (err) {
    console.warn("[push] token 획득 실패:", err);
    return null;
  }
}

/**
 * 토큰을 서버에 저장. 두 경로 모두 시도:
 *   1) /api/profile/push-token (있으면)
 *   2) Supabase expo_push_tokens 테이블 직접 upsert (fallback)
 */
export async function saveExpoToken(token: string): Promise<void> {
  // Try web API first (works through any future RLS/auth changes)
  try {
    await apiPost("/api/profile/push-token", { token, platform: Platform.OS });
    return;
  } catch {
    // fall through to direct supabase
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("expo_push_tokens").upsert(
    {
      user_id: user.id,
      token,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,token" }
  );
}

/**
 * 등록 + 저장 한 번에.
 */
export async function registerAndSavePush(): Promise<string | null> {
  const token = await registerForPush();
  if (!token) return null;
  await saveExpoToken(token);
  return token;
}
