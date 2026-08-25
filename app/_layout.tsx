import { DarkTheme, ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";
import { useEffect } from "react";
import * as Linking from "expo-linking";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { HoldOffProvider } from "@/components/holdoff-provider";
import { HOLD_OFF } from "@/constants/holdoff-theme";
import { getConversationAddressFromDeepLink } from "@/lib/notification-deep-link";
import { createTRPCClient, trpc } from "@/lib/trpc";

const queryClient = new QueryClient();
const trpcClient = createTRPCClient();

const holdOffNavigationTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: HOLD_OFF.midnight, card: HOLD_OFF.surface, text: HOLD_OFF.text, border: HOLD_OFF.border, primary: HOLD_OFF.blue },
};

function NotificationConversationRouter() {
  const router = useRouter();
  const url = Linking.useURL();

  useEffect(() => {
    if (!url) return;
    const address = getConversationAddressFromDeepLink(url);
    if (!address) return;
    router.replace({ pathname: "/conversation/[address]", params: { address } });
  }, [router, url]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <NavigationThemeProvider value={holdOffNavigationTheme}>
              <HoldOffProvider>
                <StatusBar style="light" />
                <NotificationConversationRouter />
                <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
                  <Stack.Screen name="onboarding" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="pricing" />
                  <Stack.Screen name="default-sms" />
                  <Stack.Screen name="conversation/[address]" />
                </Stack>
              </HoldOffProvider>
            </NavigationThemeProvider>
          </trpc.Provider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
