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
import { useAuth } from "@/contexts/AuthContext";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import { FooterLinks } from "@/components/FooterLinks";

GoogleSignin.configure({
  webClientId: "212900711433-rild80si8g6sg8q5j7jl8goo6o9ecnqi.apps.googleusercontent.com",
});

export default function SignUpScreen() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
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
      setLoading(false);
      setError(authError.message);
      return;
    }

    if (authData?.user) {
      console.log("[SignUp] Auth success, upserting member record...");
      const { error: memberError } = await supabase.from("members").upsert({
        id: authData.user.id,
        name: name.trim(),
        email: email.trim(),
        gender: gender?.toLowerCase() || null, // Standardize case
        membership: "Free",
        image_status: "pending",
      });

      if (memberError) {
        console.warn("Error upserting member:", memberError.message);
      } else {
        console.log("[SignUp] Member record upserted successfully");
        await refreshProfile();
      }
    }

    setLoading(false);
    // Refresh context data to ensure profile has the new data
    router.replace("/(tabs)");
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
gender === option ? styles.genderButtonActive : null,
                  ]}
                  onPress={() => setGender(option)}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <Text
                    style={[
                      styles.genderButtonText,
gender === option ? styles.genderButtonTextActive : null,
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
          <View style={styles.oauthRow}>
            <TouchableOpacity
              style={styles.oauthButton}
              onPress={() => handleOAuth("google")}
              activeOpacity={0.8}
            >
              <Text style={styles.oauthText}>🌐  Google</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.oauthButton}
              onPress={() => handleOAuth("apple")}
              activeOpacity={0.8}
            >
              <Text style={styles.oauthText}> Apple</Text>
            </TouchableOpacity>
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
    rowGap: 8, columnGap: 8,
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
    justifyContent: "space-around",
    alignItems: "center",
    marginVertical: 16,
  },
  oauthButton: {
    flex: 1,
    backgroundColor: "#1E1E38",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A4A",
  },
  oauthText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
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