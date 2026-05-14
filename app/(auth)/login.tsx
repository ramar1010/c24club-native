import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { signInWithGoogleOAuth } from "@/lib/google-auth";
import FallingGifts from "@/components/FallingGifts";
import * as AppleAuthentication from "expo-apple-authentication";
import { FooterLinks } from "@/components/FooterLinks";

const GOOGLE_ICON = require("@/assets/images/2a5758d6-4edb-4047-87bb-e6b94dbbbab0-cover.png");

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      router.replace("/(tabs)");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
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

    // Browser-based Google OAuth
    try {
      const { error: authError } = await signInWithGoogleOAuth();
      if (authError && authError !== "cancelled") setError(authError);
    } catch (e: any) {
      setError(e.message || "Google Sign In failed");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* Falling gifts background */}
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

          {/* Error */}
          {error !== "" && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Email */}
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

          {/* Password */}
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

          {/* Forgot Password */}
          <TouchableOpacity
            style={styles.forgotContainer}
            onPress={() => router.push("/(auth)/forgot-password")}
            activeOpacity={0.7}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

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

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* OAuth Buttons */}
          <View
            style={
              Platform.OS !== "ios"
                ? styles.oauthRowColumn
                : styles.oauthRow
            }
          >
            <TouchableOpacity
              style={styles.oauthButton}
              onPress={() => handleOAuth("google")}
              activeOpacity={0.8}
            >
              <View style={styles.oauthButtonContent}>
                <Image
                  source={GOOGLE_ICON}
                  style={styles.googleIcon}
                  resizeMode="contain"
                />
                <Text style={styles.oauthText}>Google</Text>
              </View>
            </TouchableOpacity>
            {Platform.OS === "ios" && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={
                  AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                }
                buttonStyle={
                  AppleAuthentication.AppleAuthenticationButtonStyle
                    .WHITE_OUTLINE
                }
                cornerRadius={100}
                style={styles.appleButton}
                onPress={() => handleOAuth("apple")}
              />
            )}
          </View>

          {/* Sign Up Link */}
          <View style={styles.bottomLink}>
            <Text style={styles.bottomLinkText}>
              Don&apos;t have an account?{" "}
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
    marginBottom: 36,
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
  forgotContainer: {
    alignItems: "flex-end",
    marginBottom: 20,
    marginTop: 4,
  },
  forgotText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "600",
  },
  signInButton: {
    backgroundColor: "#EF4444",
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 4,
  },
  signInText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#71717A",
    marginHorizontal: 12,
  },
  dividerText: {
    color: "#71717A",
    fontSize: 14,
    fontWeight: "600",
    marginHorizontal: 12,
  },
  oauthRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginVertical: 16,
    gap: 12,
  },
  oauthRowColumn: {
    flexDirection: "column",
    alignItems: "stretch",
    marginVertical: 16,
    gap: 12,
  },
  oauthButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#2A2A4A",
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  oauthButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  googleIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
  },
  oauthText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  appleButton: {
    flex: 1,
    height: 50,
    borderRadius: 100,
  },
  bottomLink: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
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