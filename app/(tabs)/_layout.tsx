import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useHoldOff } from "@/components/holdoff-provider";
import { HOLD_OFF } from "@/constants/holdoff-theme";

export default function TabLayout() {
  const { ready, store } = useHoldOff();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 10 : Math.max(insets.bottom, 8);
  if (!ready) return <View style={{ flex: 1, backgroundColor: HOLD_OFF.midnight, justifyContent: "center", alignItems: "center" }}><ActivityIndicator color={HOLD_OFF.lavender} /></View>;
  if (!store.onboarding.completed) return <Redirect href="/onboarding" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: HOLD_OFF.lavender,
        tabBarInactiveTintColor: "#8D7CAF",
        tabBarStyle: { height: 60 + bottomPadding, paddingTop: 8, paddingBottom: bottomPadding, backgroundColor: "#1E1237", borderTopColor: HOLD_OFF.border, borderTopWidth: 1 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="messages" options={{ title: "Messages", tabBarIcon: ({ color }) => <IconSymbol size={23} name="bubble.left.and.bubble.right.fill" color={color} /> }} />
      <Tabs.Screen name="interpret" options={{ title: "Interpret", tabBarIcon: ({ color }) => <IconSymbol size={23} name="bubble.left.and.bubble.right.fill" color={color} /> }} />
      <Tabs.Screen name="people" options={{ title: "People", tabBarIcon: ({ color }) => <IconSymbol size={23} name="person.2.fill" color={color} /> }} />
      <Tabs.Screen name="patterns" options={{ title: "Patterns", tabBarIcon: ({ color }) => <IconSymbol size={23} name="chart.xyaxis.line" color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ color }) => <IconSymbol size={23} name="gearshape.fill" color={color} /> }} />
    </Tabs>
  );
}
