import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  SafeAreaView,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import FallingGifts from "@/components/FallingGifts";
import { supabase } from "@/lib/supabase";

export default function MissingGenderScreen() {
  const { profile, refreshProfile } = useAuth();
  const [selectedGender, setSelectedGender] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!selectedGender) {
      setError("Please select your gender to continue.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error: updateError } = await supabase
        .from("members")
        .update({ gender: selectedGender.toLowerCase() })
        .eq("id", profile?.id);

      if (updateError) throw updateError;

      // Also update auth metadata for consistency
      await supabase.auth.updateUser({
        data: { gender: selectedGender.toLowerCase() }
      });

      await refreshProfile();
    } catch (err: any) {
      console.error("[MissingGenderScreen] Error updating gender:", err);
      setError(err.message || "Failed to save. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <FallingGifts />
      
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Welcome to C24 Club!</Text>
          <Text style={styles.subtitle}>
            Please select your gender to complete your profile and start connecting.
          </Text>

          {error !== "" && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.genderRow}>
            {["Female", "Male", "Other"].map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.genderButton,
                  selectedGender === option ? styles.genderButtonActive : undefined,
                ]}
                onPress={() => setSelectedGender(option)}
                activeOpacity={0.7}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.genderButtonText,
                    selectedGender === option ? styles.genderButtonTextActive : undefined,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[
              styles.saveButton,
              !selectedGender && styles.saveButtonDisabled
            ]}
            onPress={handleSave}
            disabled={loading || !selectedGender}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Complete Profile</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={() => supabase.auth.signOut()}
          activeOpacity={0.7}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A1A2E",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: "#1E1E38",
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: "#2A2A4A",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: "#A1A1AA",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  genderRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 32,
  },
  genderButton: {
    flex: 1,
    backgroundColor: "#1A1A2E",
    borderRadius: 16,
    paddingVertical: 16,
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
  saveButton: {
    backgroundColor: "#EF4444",
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
    backgroundColor: "#3F3F46",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
  signOutButton: {
    marginTop: 24,
    alignItems: "center",
    paddingVertical: 12,
  },
  signOutText: {
    color: "#71717A",
    fontSize: 15,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  errorContainer: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    textAlign: "center",
    fontWeight: "500",
  },
});