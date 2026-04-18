import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Eye, EyeOff } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import FallingGifts from "@/components/FallingGifts";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import { FooterLinks } from "@/components/FooterLinks";

GoogleSignin.configure({
  webClientId: "212900711433-rild80si8g6sg8q5j7jl8goo6o9ecnqi.apps.googleusercontent.com",
});

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError(authError.message);
      } else if (data.session) {
        router.replace("/(tabs)");
      }
    } catch (e: any) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setError("");

    // Native Apple Sign In (iOS only)
    if (provider === "apple") {
      try {
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
        const identityToken = credential.identityToken;
        if (!identityToken) {
          setError("Apple Sign In failed — no identity token.");
          return;
        }
        const { error: authError } = await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: identityToken,
        });
        if (authError) setError(authError.message);
      } catch (e: any) {
        if (e.code !== "ERR_REQUEST_CANCELED") {
          setError(e.message || "Apple Sign In failed");
        }
      }
      return;
    }

    // Native Google Sign In — no browser redirect needed
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;
      if (!idToken) {
        setError("Google Sign In failed — no ID token received.");
        return;
      }
      const { error: authError } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });
      if (authError) setError(authError.message);
    } catch (e: any) {
      if (e.code !== "SIGN_IN_CANCELLED") {
        setError(e.message || "Google Sign In failed");
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* ── Falling gifts background ── */}
      <FallingGifts />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoRow}>
              <Text style={styles.logoC24}>C24</Text>
              <Text style={styles.logoClub}> CLUB</Text>
            </View>
            <Text style={styles.tagline}>The Omegle That Rewards You</Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>
          </View>

          {/* Error Message */}
          {error !== "" && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#71717A"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              editable={!loading}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password"
                placeholderTextColor="#71717A"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                {showPassword ? (
                  <EyeOff size={20} color="#71717A" />
                ) : (
                  <Eye size={20} color="#71717A" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            style={styles.signInButton}
            onPress={handleSignIn}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.signInText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Forgot Password */}
          <TouchableOpacity
            style={styles.forgotButton}
            onPress={() => router.push("/(auth)/forgot-password")}
            activeOpacity={0.7}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* OAuth Buttons */}
          <View style={[styles.oauthRow, Platform.OS !== "ios" ? { flexDirection: "column" } : null]}>
            <TouchableOpacity
              style={styles.oauthButton}
              onPress={() => handleOAuth("google")}
              activeOpacity={0.8}
            >
              <Text style={styles.oauthText}>🌐  Google</Text>
            </TouchableOpacity>
            {Platform.OS === "ios" && (
              <TouchableOpacity
                style={styles.oauthButton}
                onPress={() => handleOAuth("apple")}
                activeOpacity={0.8}
              >
                <Text style={styles.oauthText}> Apple</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Sign Up Link */}
          <View style={styles.bottomLink}>
            <Text style={styles.bottomLinkText}>
              Don't have an account?{" "}
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/signup")}
              activeOpacity={0.7}
            >
              <Text style={styles.bottomLinkAction}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          <FooterLinks />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#1A1A2E",
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    flexGrow: 1,
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  logoC24: {
    fontSize: 48,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  logoClub: {
    fontSize: 48,
    fontWeight: "900",
    color: "#EF4444",
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 13,
    color: "#EF4444",
    marginTop: 6,
    letterSpacing: 0.5,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 16,
    color: "#A1A1AA",
    marginTop: 8,
  },
  errorContainer: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    textAlign: "center",
    fontWeight: "500",
  },
  inputContainer: {
    marginBottom: 14,
  },
  input: {
    backgroundColor: "#1E1E38",
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#2A2A4A",
  },
  passwordWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E38",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A4A",
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: "#FFFFFF",
  },
  eyeButton: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  signInButton: {
    backgroundColor: "#EF4444",
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 10,
  },
  signInText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
  forgotButton: {
    alignItems: "center",
    marginTop: 16,
  },
  forgotText: {
    color: "#71717A",
    fontSize: 14,
    fontWeight: "500",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#2A2A4A",
  },
  dividerText: {
    color: "#71717A",
    fontSize: 13,
    marginHorizontal: 16,
  },
  oauthRow: {
    flexDirection: "row",
    rowGap: 12, columnGap: 12,
    marginBottom: 32,
  },
  oauthButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#2A2A4A",
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: "center",
  },
  oauthText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  bottomLink: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  bottomLinkText: {
    color: "#71717A",
    fontSize: 14,
  },
  bottomLinkAction: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "700",
  },
});