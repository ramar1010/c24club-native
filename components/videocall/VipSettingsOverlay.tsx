import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { X, Save, Pin, Star } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const PLATFORMS = [
  { key: 'cashapp', label: 'CashApp', icon: 'DollarSign' },
  { key: 'tiktok', label: 'TikTok', icon: 'Music' },
  { key: 'instagram', label: 'Instagram', icon: 'Instagram' },
  { key: 'snapchat', label: 'Snapchat', icon: 'MessageSquare' },
  { key: 'discord', label: 'Discord', icon: 'MessageSquare' },
  { key: 'venmo', label: 'Venmo', icon: 'CreditCard' },
  { key: 'paypal', label: 'PayPal', icon: 'DollarSign' },
];

interface VipSettingsOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  isVip: boolean;
  vipTier?: 'basic' | 'premium' | null;
}

export const VipSettingsOverlay: React.FC<VipSettingsOverlayProps> = ({
  isVisible,
  onClose,
  isVip,
  vipTier,
}) => {
  const { profile, refreshProfile } = useAuth();
  const [socials, setSocials] = useState<Record<string, string>>({});
  const [pinnedPlatform, setPinnedPlatform] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      fetchVipSettings();
    }
  }, [profile]);

  const fetchVipSettings = async () => {
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from('vip_settings')
        .select('pinned_socials')
        .eq('user_id', profile.id)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        const socialObj: Record<string, string> = {};
        const currentSocials: string[] = data.pinned_socials || [];
        
        currentSocials.forEach((s) => {
          const [platform, username] = s.split(':');
          if (platform && username) {
            socialObj[platform.toLowerCase()] = username;
          }
        });
        setSocials(socialObj);
        
        // We assume the first one is the "pinned" one for now or we just store a flag
        // Let's use the same logic as before but store it in the array carefully
        if (currentSocials.length > 0) {
          const [first] = currentSocials[0].split(':');
          setPinnedPlatform(first.toLowerCase());
        }
      }
    } catch (err) {
      console.error('Error fetching VIP settings:', err);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      // Create the array: first the pinned one, then others
      const pinnedHandle = pinnedPlatform && socials[pinnedPlatform] 
        ? `${pinnedPlatform}:${socials[pinnedPlatform]}` 
        : null;

      const otherSocials = Object.entries(socials)
        .filter(([platform, username]) => username.trim() !== '' && platform !== pinnedPlatform)
        .map(([platform, username]) => `${platform}:${username}`);

      const finalArray = pinnedHandle ? [pinnedHandle, ...otherSocials] : otherSocials;

      const { error } = await supabase
        .from('vip_settings')
        .upsert({
          user_id: profile.id,
          pinned_socials: finalArray,
        } as any, { onConflict: 'user_id' });

      if (error) throw error;
      
      await refreshProfile();
      Alert.alert('Success', 'VIP settings saved!');
      onClose();
    } catch (error: any) {
      console.error('Error saving VIP settings:', error);
      Alert.alert('Error', error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSocial = (platform: string, username: string) => {
    setSocials((prev) => ({ ...prev, [platform]: username }));
  };

  const isPremium = vipTier === 'premium';

  if (!isPremium) {
    return (
      <Modal
        visible={isVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.vipGateContainer}>
            <Star size={48} color="#FACC15" fill="#FACC15" />
            <Text style={styles.vipGateTitle}>Premium VIP Only</Text>
            <Text style={styles.vipGateText}>
              Social media pinning is exclusive to Premium VIP members. Upgrade to Premium to show off your socials during video calls!
            </Text>
            <TouchableOpacity style={styles.upgradeButton}>
              <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.gateCloseButton}>
              <Text style={styles.gateCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>VIP Settings</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionHeader}>Social Handles</Text>
          {PLATFORMS.map((platform) => {
            const isPinned = pinnedPlatform === platform.key;
            return (
              <View key={platform.key} style={styles.socialInputRow}>
                <View style={styles.inputLabelContainer}>
                  <Text style={styles.inputLabel}>{platform.label}</Text>
                  <TouchableOpacity
                    style={[styles.pinButton,isPinned ? styles.pinButtonActive : null]}
                    onPress={() => setPinnedPlatform(isPinned ? null : platform.key)}
                  >
                    <Pin size={16} color={isPinned ? '#FFFFFF' : '#71717A'} fill={isPinned ? '#FFFFFF' : 'transparent'} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.textInput}
                  value={socials[platform.key] || ''}
                  onChangeText={(text) => updateSocial(platform.key, text)}
                  placeholder={`@username`}
                  placeholderTextColor="#71717A"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Save size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    marginTop: 60,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A4A',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 5,
  },
  scrollContent: {
    padding: 20,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#71717A',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 20,
  },
  socialInputRow: {
    marginBottom: 20,
  },
  inputLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pinButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#1E1E38',
  },
  pinButtonActive: {
    backgroundColor: '#EF4444',
  },
  textInput: {
    backgroundColor: '#1E1E38',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2A2A4A',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#2A2A4A',
  },
  saveButton: {
    backgroundColor: '#EF4444',
    borderRadius: 100,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: 10, columnGap: 10,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  vipGateContainer: {
    backgroundColor: '#1E1E38',
    borderRadius: 30,
    padding: 30,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#FACC15',
  },
  vipGateTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 20,
    marginBottom: 12,
  },
  vipGateText: {
    fontSize: 16,
    color: '#A1A1AA',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  upgradeButton: {
    backgroundColor: '#FACC15',
    borderRadius: 100,
    paddingVertical: 16,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#1A1A2E',
    fontSize: 17,
    fontWeight: '800',
  },
  gateCloseButton: {
    marginTop: 20,
    padding: 10,
  },
  gateCloseButtonText: {
    color: '#71717A',
    fontSize: 14,
    fontWeight: '700',
  },
});