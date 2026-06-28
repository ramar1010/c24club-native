/**
 * BatteryOptimizationPrompt
 *
 * Android-only, one-time modal that asks the user to exempt the app from
 * battery optimization so push notifications are always delivered.
 *
 * Shown once after the first login, stored in AsyncStorage under the key
 * "battery_prompt_shown". Once shown (regardless of user choice) it never
 * appears again.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as IntentLauncher from "expo-intent-launcher";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const STORAGE_KEY = "battery_prompt_shown";
const PACKAGE_NAME = "com.c24club.app";

interface Props {
  /** Pass the authenticated user's id (or any truthy value) to trigger the check. */
  isAuthenticated: boolean;
}

export default function BatteryOptimizationPrompt({ isAuthenticated }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only relevant on Android
    if (Platform.OS !== "android") return;
    // Only check when a user is authenticated
    if (!isAuthenticated) return;

    (async () => {
      try {
        const shown = await AsyncStorage.getItem(STORAGE_KEY);
        if (shown === null) {
          // Not shown yet — show it
          setVisible(true);
        }
      } catch {
        // If AsyncStorage fails, silently skip
      }
    })();
  }, [isAuthenticated]);

  const markShown = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Ignore storage errors
    }
  };

  const handleAllow = async () => {
    setVisible(false);
    await markShown();
    try {
      await IntentLauncher.startActivityAsync(
        "android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
        { data: `package:${PACKAGE_NAME}` }
      );
    } catch {
      // Fallback if the direct dialog intent isn't supported on this device
      try {
        await IntentLauncher.startActivityAsync(
          "android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS"
        );
      } catch {
        // Silent fail — we already dismissed the modal
      }
    }
  };

  const handleLater = async () => {
    setVisible(false);
    await markShown();
  };

  // Android-only; return null on every other platform
  if (Platform.OS !== "android") return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleLater}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Icon row */}
          <Text style={styles.icon}>🔋</Text>

          {/* Title */}
          <Text style={styles.title}>Enable Background Notifications</Text>

          {/* Body */}
          <Text style={styles.body}>
            Allow C24 Club to run in the background so you never miss a match or message.{"\n\n"}
            <Text style={styles.bodyHighlight}>✅ Get notified instantly when girls or guys match with you{"\n"}</Text>
            <Text style={styles.bodyHighlight}>✅ Earn more reward minutes from match activity{"\n"}</Text>
            <Text style={styles.bodyHighlight}>✅ Never miss a direct call or DM{"\n\n"}</Text>
            Just tap <Text style={styles.bodyBold}>'Allow'</Text> on the next screen — takes 2 seconds.
          </Text>

          {/* Primary CTA */}
          <TouchableOpacity
            style={styles.allowButton}
            activeOpacity={0.8}
            onPress={handleAllow}
          >
            <Text style={styles.allowButtonText}>Allow (Recommended)</Text>
          </TouchableOpacity>

          {/* Ghost CTA */}
          <TouchableOpacity
            style={styles.laterButton}
            activeOpacity={0.7}
            onPress={handleLater}
          >
            <Text style={styles.laterButtonText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#1A1A2E",
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 14,
    letterSpacing: 0.3,
  },
  body: {
    fontSize: 14,
    color: "#A0A0B8",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  bodyBold: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  bodyHighlight: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  allowButton: {
    width: "100%",
    backgroundColor: "#EF4444",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  allowButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  laterButton: {
    width: "100%",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  laterButtonText: {
    color: "#6B6B8A",
    fontSize: 15,
    fontWeight: "500",
  },
});