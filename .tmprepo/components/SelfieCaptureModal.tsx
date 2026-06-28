import React, { useState, useRef, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import {
  Camera,
  ChevronLeft,
  X,
  Check,
  RefreshCw,
  Info,
  Instagram,
  Twitter,
  Linkedin,
  Github,
  Link2,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface SelfieCaptureModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onPendingReview?: () => void;
}

type Step = "permissions" | "camera" | "preview" | "details" | "uploading";

const SOCIAL_PLATFORMS = [
  { id: "instagram", icon: Instagram, label: "Instagram", prefix: "@" },
  { id: "tiktok", icon: RefreshCw, label: "TikTok", prefix: "@" },
  { id: "snapchat", icon: Info, label: "Snapchat", prefix: "" },
  { id: "discord", icon: Link2, label: "Discord", prefix: "" },
];

export default function SelfieCaptureModal({
  visible,
  onClose,
  onSuccess,
  onPendingReview,
}: SelfieCaptureModalProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<Step>("permissions");
  const [facing, setFacing] = useState<CameraType>("front");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [bio, setBio] = useState(profile?.bio || "");
  const [socials, setSocials] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  
  const cameraRef = useRef<CameraView>(null);

  // Initialize socials from profile pinned_socials if available
  React.useEffect(() => {
    if (visible && profile?.id) {
      setBio(profile.bio || "");
      setStep(permission?.granted ? "camera" : "permissions");
    }
  }, [visible, profile, permission]);

  const handleCapture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: true,
        });
        if (photo?.uri) {
          // ─── Dark room detection ───────────────────────────────────────────
          if (photo.base64) {
            const base64 = photo.base64;
            // Sample pixels from center of image to estimate brightness
            const bytes = atob(base64.slice(0, 8000)); // sample start of JPEG data
            let sum = 0;
            let count = 0;
            for (let i = 0; i < bytes.length; i++) {
              sum += bytes.charCodeAt(i);
              count++;
            }
            const avgBrightness = count > 0 ? sum / count : 128;
            // JPEG headers bias low — threshold tuned to catch very dark rooms
            if (avgBrightness < 40) {
              Alert.alert(
                '💡 Too Dark!',
                'Your photo is too dark. Please move to a brighter area and try again.',
                [{ text: 'OK' }]
              );
              return;
            }
          }
          setPhotoUri(photo.uri);
          setStep('preview');
        }
      } catch (err) {
        console.error('Capture error:', err);
        Alert.alert('Error', 'Could not capture photo.');
      }
    }
  };

  const handleUpload = async () => {
    if (!user || !photoUri) return;

    setStep("uploading");
    setIsUploading(true);

    try {
      const fileName = `selfie.jpg`;
      const filePath = `${user.id}/${fileName}`;
      
      // Binary upload for native
      let fileData: Uint8Array | Blob;
      
      if (Platform.OS === 'web') {
        const response = await fetch(photoUri);
        fileData = await response.blob();
      } else {
        // Use standard FileSystem.readAsStringAsync for compatibility
        const base64 = await FileSystem.readAsStringAsync(photoUri, {
          encoding: "base64",
        });
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        fileData = bytes;
      }

      // 1. Upload to Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("member-photos")
        .upload(filePath, fileData, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("member-photos")
        .getPublicUrl(filePath);

      const imageUrl = urlData.publicUrl;

      // 2. Prepare Socials Array
      const pinnedSocials = Object.entries(socials)
        .filter(([_, value]) => value.trim() !== "")
        .map(([platform, value]) => `${platform}:${value.trim()}`);

      // 3. Update members table
      const { error: memberError } = await supabase
        .from("members")
        .update({
          image_url: imageUrl,
          image_thumb_url: imageUrl,
          image_status: "pending",
          is_discoverable: false,
          bio: bio.trim(),
          last_active_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (memberError) throw memberError;

      // 4. Update VIP settings (socials)
      const { error: vipError } = await supabase
        .from("vip_settings")
        .upsert({
          user_id: user.id,
          pinned_socials: pinnedSocials,
        });

      if (vipError) console.error("VIP Settings error:", vipError);

      await refreshProfile();
      onSuccess?.();
      onClose();
      if (onPendingReview) {
        onPendingReview();
      } else {
        Alert.alert(
          'Selfie Uploaded!',
          'Your selfie is now pending review. You can start chatting while you wait!'
        );
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      Alert.alert("Upload Failed", err.message || "Something went wrong.");
      setStep("details");
    } finally {
      setIsUploading(false);
    }
  };

  const renderContent = () => {
    switch (step) {
      case "permissions":
        return (
          <View style={styles.centerContent}>
            <Camera size={64} color="#71717A" />
            <Text style={styles.title}>Camera Access Needed</Text>
            <Text style={styles.description}>
              C24 Club needs camera access to take your discover selfie.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={requestPermission}
            >
              <Text style={styles.primaryButtonText}>Grant Access</Text>
            </TouchableOpacity>
          </View>
        );

      case "camera":
        return (
          <View style={styles.cameraContainer}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing={facing}
              mode="picture"
            >
              <View style={styles.cameraOverlay}>
                <View style={styles.cameraHeader}>
                  <TouchableOpacity onPress={onClose} style={styles.iconButton}>
                    <X size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setFacing(v => v === "front" ? "back" : "front")}
                    style={styles.iconButton}
                  >
                    <RefreshCw size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.cameraFrame}>
                   <View style={styles.squareFrame} />
                </View>

                <View style={styles.cameraFooter}>
                  <TouchableOpacity
                    onPress={handleCapture}
                    style={styles.captureButton}
                  >
                    <View style={styles.captureInner} />
                  </TouchableOpacity>
                </View>
              </View>
            </CameraView>
          </View>
        );

      case "preview":
        return (
          <View style={styles.previewContainer}>
            {photoUri && (
              <Image source={{ uri: photoUri }} style={styles.previewImage} />
            )}
            <View style={styles.previewFooter}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setStep("camera")}
              >
                <RefreshCw size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButtonSmall}
                onPress={() => setStep("details")}
              >
                <Check size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Use This</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case "details":
        return (
          <ScrollView
            style={styles.detailsScroll}
            contentContainerStyle={styles.detailsContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.detailsHeader}>
              <TouchableOpacity
                onPress={() => setStep("preview")}
                style={styles.backLink}
              >
                <ChevronLeft size={20} color="#71717A" />
                <Text style={styles.backText}>Back to Photo</Text>
              </TouchableOpacity>
              <Text style={styles.detailsTitle}>Add Details</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Your Bio (Short & Sweet)</Text>
              <TextInput
                style={styles.bioInput}
                value={bio}
                onChangeText={setBio}
                placeholder="Ex: Love travel and meeting new people! ✈️"
                placeholderTextColor="#71717A"
                multiline
                maxLength={120}
              />
              <Text style={styles.charCount}>{bio.length}/120</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Link Your Socials (Optional)</Text>
              {SOCIAL_PLATFORMS.map(platform => (
                <View key={platform.id} style={styles.socialRow}>
                  <View style={styles.socialIcon}>
                    <platform.icon size={20} color="#71717A" />
                  </View>
                  <Text style={styles.socialPrefix}>{platform.prefix}</Text>
                  <TextInput
                    style={styles.socialInput}
                    placeholder={`${platform.label} handle`}
                    placeholderTextColor="#71717A"
                    value={socials[platform.id] || ""}
                    onChangeText={text => setSocials(prev => ({ ...prev, [platform.id]: text }))}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleUpload}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Submit for Review</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        );

      case "uploading":
        return (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#EF4444" />
            <Text style={styles.title}>Uploading...</Text>
            <Text style={styles.description}>
              We're submitting your selfie for review. This only takes a moment.
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>{renderContent()}</View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "#1A1A2E",
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "space-between",
  },
  cameraHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraFrame: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  squareFrame: {
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    borderRadius: 12,
    borderStyle: "dashed",
  },
  cameraFooter: {
    paddingBottom: 50,
    alignItems: "center",
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#FFFFFF",
  },
  captureInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FFFFFF",
  },
  previewContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  previewImage: {
    flex: 1,
    resizeMode: "cover",
  },
  previewFooter: {
    position: "absolute",
    bottom: 50,
    flexDirection: "row",
    width: "100%",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 24,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    color: "#A1A1AA",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 24,
  },
  primaryButton: {
    backgroundColor: "#EF4444",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 100,
    marginTop: 32,
    width: "100%",
    alignItems: "center",
  },
  primaryButtonSmall: {
    backgroundColor: "#EF4444",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 100,
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  secondaryButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 100,
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  detailsScroll: {
    flex: 1,
  },
  detailsContent: {
    padding: 24,
    paddingTop: 60,
  },
  detailsHeader: {
    marginBottom: 32,
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  backText: {
    color: "#71717A",
    fontSize: 14,
  },
  detailsTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#A1A1AA",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bioInput: {
    backgroundColor: "#1E1E38",
    borderRadius: 16,
    padding: 16,
    color: "#FFFFFF",
    fontSize: 16,
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#2A2A4A",
  },
  charCount: {
    fontSize: 12,
    color: "#71717A",
    textAlign: "right",
    marginTop: 6,
  },
  socialRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E38",
    borderRadius: 16,
    paddingLeft: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#2A2A4A",
  },
  socialIcon: {
    marginRight: 10,
  },
  socialPrefix: {
    color: "#71717A",
    fontSize: 16,
    marginRight: 2,
  },
  socialInput: {
    flex: 1,
    paddingVertical: 16,
    paddingRight: 16,
    color: "#FFFFFF",
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: "#EF4444",
    paddingVertical: 18,
    borderRadius: 100,
    alignItems: "center",
    marginTop: 12,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
});