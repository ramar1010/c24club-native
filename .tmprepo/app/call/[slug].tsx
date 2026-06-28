import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/AuthContext";
import { useCall } from "@/contexts/CallContext";
import { supabase } from "@/lib/supabase";
import FallingGifts from "@/components/FallingGifts";

interface CallMember {
  id: string;
  name: string;
  gender: string | null;
  image_url: string | null;
  is_discoverable: boolean;
}

export default function CallSlugScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { startCall } = useCall();

  const [member, setMember] = useState<CallMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Pulsing ring animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    const fetchMember = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("members")
        .select("id, name, gender, image_url, is_discoverable")
        .eq("call_slug", slug)
        .maybeSingle();

      if (data) {
        setMember(data as CallMember);
        setNotFound(false);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    };

    fetchMember();
  }, [slug]);

  const handleVideoChat = async () => {
    if (!user) {
      router.push("/(auth)/login");
      return;
    }
    if (!member) return;
    if (user.id === member.id) {
      Alert.alert("Oops!", "You can't call yourself!");
      return;
    }
    await startCall(member.id, member.gender || undefined);
  };

  if (loading) {
    return (
      <View style={styles.fullScreen}>
        <FallingGifts />
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#EF4444" />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (notFound || !member) {
    return (
      <View style={styles.fullScreen}>
        <FallingGifts />
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          <View style={styles.centered}>
            {/* Logo */}
            <View style={styles.logoRow}>
              <Text style={styles.logoC24}>C24</Text>
              <Text style={styles.logoClub}> CLUB</Text>
            </View>
            <View style={styles.notFoundCard}>
              <Text style={styles.notFoundEmoji}>🔗</Text>
              <Text style={styles.notFoundTitle}>Link Unavailable</Text>
              <Text style={styles.notFoundSubtitle}>
                This call link is no longer active.
              </Text>
              <TouchableOpacity
                style={styles.homeButton}
                activeOpacity={0.85}
                onPress={() => router.replace("/(auth)/login")}
              >
                <Text style={styles.homeButtonText}>Go to C24 Club</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.poweredBy}>Powered by C24 Club</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.fullScreen}>
      <FallingGifts />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.centered}>
          {/* Logo */}
          <View style={styles.logoRow}>
            <Text style={styles.logoC24}>C24</Text>
            <Text style={styles.logoClub}> CLUB</Text>
          </View>

          {/* Avatar with pulsing ring */}
          <View style={styles.avatarContainer}>
            {/* Pulsing ring behind avatar */}
            <Animated.View
              style={{
                position: "absolute",
                width: 140,
                height: 140,
                borderRadius: 70,
                borderWidth: 3,
                borderColor: "#22C55E",
                opacity: 0.6,
                transform: [{ scale: pulseAnim }],
              }}
            />
            {/* Avatar */}
            {member.image_url ? (
              <Image
                source={{ uri: member.image_url }}
                style={styles.avatar}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  borderWidth: 3,
                  borderColor: "#22C55E",
                  backgroundColor: "#2A2A4A",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={styles.avatarInitial}>
                  {(member.name || "?")[0].toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Name & subtitle */}
          <Text style={styles.memberName}>{member.name}</Text>
          <Text style={styles.subtitle}>wants to video chat with you</Text>

          {/* CTA */}
          <TouchableOpacity
            style={styles.videoChatButton}
            activeOpacity={0.85}
            onPress={handleVideoChat}
          >
            <Text style={styles.videoChatButtonText}>Video Chat</Text>
          </TouchableOpacity>

          {/* Powered by */}
          <Text style={styles.poweredBy}>Powered by C24 Club</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: "#1A1A2E",
  },
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  // Logo
  logoRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 40,
  },
  logoC24: {
    fontSize: 42,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  logoClub: {
    fontSize: 42,
    fontWeight: "900",
    color: "#EF4444",
    letterSpacing: -1,
  },
  // Avatar
  avatarContainer: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "#22C55E",
  },
  avatarPlaceholder: {
    backgroundColor: "#2A2A4A",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 48,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  // Text
  memberName: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#A1A1AA",
    textAlign: "center",
    marginBottom: 40,
  },
  // CTA
  videoChatButton: {
    backgroundColor: "#22C55E",
    borderRadius: 100,
    paddingVertical: 18,
    paddingHorizontal: 48,
    alignItems: "center",
    marginBottom: 32,
  },
  videoChatButtonText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  // Powered by
  poweredBy: {
    fontSize: 13,
    color: "#3F3F5A",
    textAlign: "center",
  },
  // Not found
  notFoundCard: {
    backgroundColor: "#1E1E38",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A4A",
    marginBottom: 24,
    width: "100%",
  },
  notFoundEmoji: {
    fontSize: 40,
    marginBottom: 16,
  },
  notFoundTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  notFoundSubtitle: {
    fontSize: 15,
    color: "#A1A1AA",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  homeButton: {
    backgroundColor: "#EF4444",
    borderRadius: 100,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
  },
  homeButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});