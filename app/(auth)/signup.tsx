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
import { generateNonce } from "@/lib/auth-utils";
import { signInWithGoogle } from "@/lib/google-auth";
import FallingGifts from "@/components/FallingGifts";
import { useAuth } from "@/contexts/AuthContext";
import * as AppleAuthentication from "expo-apple-authentication";
import { FooterLinks } from "@/components/FooterLinks";
import { Image } from "react-native";

export default function SignUpScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const validate = (): string | null => {
    if (!name.trim()) return "Name is required";
    if (!email.trim()) return "Email is required";
    if (!gender) return "Please select your gender";
    if (!password) return "Password is required";
    if (password.length < 6) return "Password must be at least 6 characters";
    if (password !== confirmPassword) return "Passwords do not match";
    return null;
  };

  const handleSignUp = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim(),
            gender: gender?.toLowerCase() || null,
          },
        },
      });

      if (authError) {
        console.error("[SignUp] Auth error:", authError);
        // Handle common Supabase errors with more user-friendly messages
        if (authError.message.includes("Database error")) {
          setError("Database error saving new user. This usually happens if the email system is temporarily down. Please try again in a few minutes.");
        } else if (authError.message.toLowerCase().includes("network request failed")) {
          setError("Network request failed. Please check your internet connection and try again.");
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }

      if (!authData.session) {
        // Confirmation might be required
        console.log("[SignUp] Signup successful, confirmation required.");
        setLoading(false);
        setError("Success! Please check your email to confirm your account before signing in.");
        // Optional: clear form or redirect to login after a delay
        setTimeout(() => {
          router.replace("/(auth)/login");
        }, 3000);
      } else {
        // Session exists — manually navigate to (tabs) to avoid hanging
        console.log("[SignUp] Signup successful, session established. Navigating to (tabs)...");
        setLoading(false);
        router.replace("/(tabs)");
      }
    } catch (err: any) {
      console.error("[SignUp] Unexpected error:", err);
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "apple" | "google") => {
    setError("");

    if (provider === "google") {
      setLoading(true);
      try {
        const data = await signInWithGoogle();
        // AuthContext will handle navigation on session change

        // If login successful and we have a gender selected, update the metadata
        if (data && gender) {
          await supabase.auth.updateUser({
            data: { gender: gender.toLowerCase() }
          });
        }
      } catch (err: any) {
        setError(err.message || "Google Sign In failed");
      } finally {
        setLoading(false);
      }
      return;
    }

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

        // If login successful and we have a gender selected, update the metadata
        // The profile will be auto-created by AuthContext using this metadata
        if (!authError && gender) {
          await supabase.auth.updateUser({
            data: { gender: gender.toLowerCase() }
          });
        }
      } catch (e: any) {
        if (e.code !== "ERR_REQUEST_CANCELED") {
          setError(e.message || "Apple Sign In failed");
        }
      }
      return;
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
            <Text style={styles.tagline}>The Video Chat That Rewards You</Text>
            <Text style={styles.subtitle}>Create your account</Text>
          </View>

          {/* Error */}
          {error !== "" && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Name */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor="#71717A"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
              editable={!loading}
            />
          </View>

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

          {/* Gender Selection */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Select Gender</Text>
            <View style={styles.genderRow}>
              {["Female", "Male", "Other"].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.genderButton,
gender === option ? styles.genderButtonActive : undefined,
                  ]}
                  onPress={() => setGender(option)}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <Text
                    style={[
                      styles.genderButtonText,
gender === option ? styles.genderButtonTextActive : undefined,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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

          {/* Confirm Password */}
          <View style={styles.inputContainer}>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm Password"
                placeholderTextColor="#71717A"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirm(!showConfirm)}
                activeOpacity={0.7}
              >
                {showConfirm ? (
                  <EyeOff size={20} color="#71717A" />
                ) : (
                  <Eye size={20} color="#71717A" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Create Account Button */}
          <TouchableOpacity
            style={styles.signUpButton}
            onPress={handleSignUp}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.signUpText}>Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* OAuth Buttons */}
          <View style={[styles.oauthRow, Platform.OS !== "ios" ? { flexDirection: "column" } : { justifyContent: "center" }]}>
            {Platform.OS === "ios" && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
                cornerRadius={100}
                style={[styles.oauthButton, { height: 50, borderWidth: 0, width: "100%", flex: 0 }]}
                onPress={() => handleOAuth("apple")}
              />
            )}

            {Platform.OS !== "ios" && (
              <TouchableOpacity
                style={[
                  styles.oauthButton,
                  { width: "100%", backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
                ]}
                onPress={() => handleOAuth("google")}
                activeOpacity={0.8}
                disabled={loading}
              >
                <View style={styles.googleButtonContent}>
                  <Image
                    source={{
                      uri: "https://authjs.dev/img/providers/google.svg",
                    }}
                    style={styles.googleIcon}
                  />
                  <Text style={styles.googleText}>
                    Continue with Google
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Sign In Link */}
          <View style={styles.bottomLink}>
            <Text style={styles.bottomLinkText}>
              Already have an account?{" "}
            </Text>
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Text style={styles.bottomLinkAction}>Sign In</Text>
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
  inputLabel: {
    fontSize: 14,
    color: "#A1A1AA",
    marginBottom: 8,
    marginLeft: 4,
  },
  genderRow: {
    flexDirection: "row",
    gap: 8,
  },
  genderButton: {
    flex: 1,
    backgroundColor: "#1E1E38",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A4A",
  },
  genderButtonActive: {
    borderColor: "#EF4444",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  genderButtonText: {
    color: "#71717A",
    fontSize: 15,
    fontWeight: "600",
  },
  genderButtonTextActive: {
    color: "#FFFFFF",
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
  signUpButton: {
    backgroundColor: "#EF4444",
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 10,
  },
  signUpText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
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
    gap: 12,
    marginBottom: 32,
    alignItems: "center",
  },
  oauthButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#2A2A4A",
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    height: 50,
  },
  googleButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  googleText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "700",
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