import { useEffect, useState, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { supabase } from "./supabase";

/**
 * Expo Push 알림 훅.
 * - 권한 요청 + Expo Push Token 획득
 * - Supabase 에 토큰 저장 (expo_push_tokens 테이블 사용 — 별도 마이그레이션)
 * - 수신 리스너 + 탭 리스너 (로그)
 */
export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      if (!token) return;
      setExpoPushToken(token);
      persistToken(token);
    });

    notificationListener.current = Notifications.addNotificationReceivedListener((n) => {
      console.log("[push] 수신:", n.request.content.title);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((r) => {
      const data = r.notification.request.content.data;
      console.log("[push] 탭:", data);
      // TODO: data.url 기반 딥링크 라우팅
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  async function persistToken(token: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("expo_push_tokens").upsert(
        {
          user_id: user.id,
          token,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,token" }
      );
      if (!error) setRegistered(true);
    } catch (err) {
      console.warn("[push] token 저장 실패:", err);
    }
  }

  return { expoPushToken, registered };
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn("[push] 실기기가 필요합니다 (시뮬레이터 불가)");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    console.warn("[push] 권한 거부");
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  try {
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return token.data;
  } catch (err) {
    console.warn("[push] token 획득 실패:", err);
    return null;
  }
}
