import { Link, Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCall } from "@/contexts/CallContext";

export default function NotFoundScreen() {
  const router = useRouter();
  const { incomingInvite } = useCall();

  useEffect(() => {
    // If we land here, wait a bit and then redirect to home if no call popup appears
    // This handles the brief "Not Found" flicker during notification deep linking
    const timer = setTimeout(() => {
      if (!incomingInvite) {
        router.replace("/");
      }
    }, 3500);
    return () => clearTimeout(timer);
  }, [incomingInvite, router]);

  return (
    <>
      <Stack.Screen options={{ title: "Loading..." }} />
      <SafeAreaView style={styles.container}>
        <View style={styles.inner}>
          <ActivityIndicator size="large" color="#EF4444" style={{ marginBottom: 20 }} />
          <Text style={styles.title}>Loading...</Text>
          <Text style={styles.subtitle}>
            Please wait while we connect you.
          </Text>
          <Link href="/" style={styles.link} replace>
            <Text style={styles.linkText}>Back to Home</Text>
          </Link>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A1A2E",
  },
  inner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#A1A1AA",
    textAlign: "center",
    marginBottom: 24,
  },
  link: {
    marginTop: 8,
  },
  linkText: {
    fontSize: 16,
    color: "#EF4444",
    textDecorationLine: "underline",
  },
});