import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { BRAND } from "../../../../packages/shared/brand-tokens";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: BRAND.colors.paper,
          borderBottomWidth: BRAND.borders.standard,
          borderBottomColor: BRAND.colors.ink,
        },
        headerTitleStyle: {
          fontSize: 14,
          letterSpacing: 2,
          color: BRAND.colors.ink,
          fontWeight: "700",
          textTransform: "uppercase",
        },
        tabBarActiveTintColor: BRAND.colors.pink,
        tabBarInactiveTintColor: BRAND.colors.graphite,
        tabBarStyle: {
          backgroundColor: BRAND.colors.paper,
          borderTopWidth: BRAND.borders.standard,
          borderTopColor: BRAND.colors.ink,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          letterSpacing: 1,
          textTransform: "uppercase",
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="bolts"
        options={{
          title: "볼트",
          tabBarIcon: ({ color, size }) => <Feather name="box" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="nuts"
        options={{
          title: "너트",
          tabBarIcon: ({ color, size }) => <Feather name="users" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: "AI",
          tabBarIcon: ({ color, size }) => <Feather name="message-circle" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="approvals"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "나",
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
