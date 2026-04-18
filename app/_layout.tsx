import "@/global.css";
import "@/lib/webStylePolyfill";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import "react-native-reanimated";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { Platform, Pressable, Text, View } from "react-native";
import Toast, { ToastConfig } from "react-native-toast-message";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import GluestackInitializer from "@/components/GluestackInitializer";
import useColorScheme from "@/hooks/useColorScheme";
import { Stack, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CallProvider } from "@/contexts/CallContext";
import { CallInviteListener } from "@/components/video-call/CallInviteListener";
import { usePushNotifications } from "@/lib/usePushNotifications";
import { useDmToast } from "@/hooks/useDmToast";
import { useGiftToast } from "@/hooks/useGiftToast";
import { useBanCheck } from "@/hooks/useBanCheck";
import BannedScreen from "@/components/BannedScreen";
import BatteryOptimizationPrompt from "@/components/BatteryOptimizationPrompt";
import { useRedemptionNotifications } from "@/hooks/useRedemptionNotifications";

// Custom toast config for DM notifications
const toastConfig: ToastConfig = {
  dmToast: ({ text1, text2, onPress }) => (
    <Pressable
      onPress={onPress}
      style={{
        width: '92%',
        backgroundColor: '#1E1E3A',
        borderLeftWidth: 4,
        borderLeftColor: '#EF4444',
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'flex-start',
              }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14, marginBottom: 4 }}>
          {text1}
        </Text>
        <Text style={{ color: '#A0A0B8', fontSize: 13, lineHeight: 19 }}>
          {text2}
        </Text>
      </View>
      <Text style={{ color: '#EF4444', fontSize: 12, marginLeft: 8, marginTop: 2 }}>Open</Text>
    </Pressable>
  ),
  giftToast: ({ text1, text2 }) => (
    <Pressable
      style={{
        width: '92%',
        backgroundColor: '#1E1E3A',
        borderLeftWidth: 4,
        borderLeftColor: '#FACC15',
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
              }}
    >
      <Text style={{ fontSize: 28, marginRight: 12 }}>🎁</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#FACC15', fontWeight: '700', fontSize: 14, marginBottom: 3 }}>
          {text1}
        </Text>
        <Text style={{ color: '#A0A0B8', fontSize: 13, lineHeight: 19 }}>
          {text2}
        </Text>
      </View>
    </Pressable>
  ),
};

import { initCatDoesWatch } from "@/catdoes.watch";
initCatDoesWatch();

// Set up Android notification channels at module level
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "C24 Club",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#EF4444",
    showBadge: true,
    enableLights: true,
    enableVibrate: true,
  });

  // High-priority channel for incoming direct video calls
  Notifications.setNotificationChannelAsync("incoming_calls", {
    name: "Incoming Calls",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500],
    lightColor: "#22C55E",
    sound: "default",
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    showBadge: true,
    enableLights: true,
    enableVibrate: true,
  });

  // Promotions channel for VIP gifting reminders and gift attempt alerts
  Notifications.setNotificationChannelAsync("promotions", {
    name: "Promotions & Offers",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
  });
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
    },
  },
});

function RootLayoutInner({ colorScheme, loaded }: { colorScheme: any; loaded: boolean }) {
  const auth = useAuth();
  const { session, loading } = auth || { session: null, loading: true };
  const segments = useSegments();
  const router = useRouter();

  // Ban check — always fresh, never cached
  const { isBanned, banData, banLoading, recheckBan, clearBan } = useBanCheck();

  // Register push notifications once auth is loaded and a session exists
  usePushNotifications();

  // In-app DM toast notifications
  useDmToast();
  useGiftToast();

  // Realtime reward redemption status notifications
  useRedemptionNotifications(session?.user?.id);

  console.log("[RootLayoutInner] auth state:", { loaded, loading, hasSession: !!session, segments });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  useEffect(() => {
    if (!loaded || loading) return;
    const inAuthGroup = segments[0] === "(auth)";
    const inCallGroup = segments[0] === "call";
    
    if (!session && !inAuthGroup && !inCallGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, loading, loaded, segments]);

  if (!loaded) return null;

  // ── Banned overlay — blocks all navigation ─────────────────────────────────
  if (!banLoading && isBanned && banData && session) {
    return (
      <GluestackInitializer colorScheme={colorScheme}>
        <BannedScreen ban={banData} onUnbanned={() => { clearBan(); recheckBan(); }} />
        <StatusBar style="auto" />
        <Toast config={toastConfig} />
      </GluestackInitializer>
    );
  }

  return (
    <GluestackInitializer colorScheme={colorScheme}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#1A1A2E" } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="call" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <CallInviteListener />
      <StatusBar style="auto" />
      <Toast config={toastConfig} />
      <BatteryOptimizationPrompt isAuthenticated={!!session} />
    </GluestackInitializer>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CallProvider>
            <RootLayoutInner colorScheme={colorScheme} loaded={!!loaded} />
          </CallProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}