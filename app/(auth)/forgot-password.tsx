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
import { ArrowLeft, Mail } from "lucide-react-native";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }

    setError("");
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo:
          Platform.OS === "web"
            ? window.location.origin
            : "myapp://",
      }
    );

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
    } else {
      setSent(true);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
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
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {sent ? (
            /* Success State */
            <View style={styles.successContainer}>
              <View style={styles.mailCircle}>
                <Mail size={40} color="#22C55E" />
              </View>
              <Text style={styles.successTitle}>Check Your Email</Text>
              <Text style={styles.successSubtitle}>
                We've sent a password reset link to{"\n"}
                <Text style={styles.emailHighlight}>{email}</Text>
              </Text>
              <TouchableOpacity
                style={styles.backToLoginButton}
                onPress={() => router.back()}
                activeOpacity={0.85}
              >
                <Text style={styles.backToLoginText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Form */
            <>
              <View style={styles.headerContainer}>
                <Text style={styles.title}>Forgot Password</Text>
                <Text style={styles.subtitle}>
                  Enter your email and we'll send you a reset link
                </Text>
              </View>

              {error !== "" && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

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

              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleReset}
                activeOpacity={0.85}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.resetText}>Reset Password</Text>
                )}
              </TouchableOpacity>
            </>
          )}
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
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    marginTop: 8,
  },
  headerContainer: {
    marginTop: 40,
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#A1A1AA",
    lineHeight: 22,
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
    marginBottom: 20,
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
  resetButton: {
    backgroundColor: "#EF4444",
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: "center",
  },
  resetText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  mailCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 16,
    color: "#A1A1AA",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  emailHighlight: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  backToLoginButton: {
    borderWidth: 1.5,
    borderColor: "#2A2A4A",
    borderRadius: 100,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  backToLoginText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});