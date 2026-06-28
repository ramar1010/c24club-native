import React from 'react';
import {
  Modal,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Star, Zap, Video, ShieldCheck, X } from 'lucide-react-native';
import { useCall } from '@/contexts/CallContext';
import { useRouter } from 'expo-router';

export const VipGateModal = () => {
  const { showVipModal, setShowVipModal } = useCall();
  const router = useRouter();

  const handleSubscribe = () => {
    setShowVipModal(false);
    router.push('/vip');
  };

  return (
    <Modal
      visible={showVipModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowVipModal(false)}
    >
      <Pressable style={styles.backdrop} onPress={() => setShowVipModal(false)}>
        <Pressable style={styles.container} onPress={() => {}}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={() => setShowVipModal(false)}>
            <X size={22} color="#71717A" />
          </TouchableOpacity>

          {/* Header */}
          <Star size={48} color="#FACC15" fill="#FACC15" style={styles.icon} />
          <Text style={styles.title}>VIP Required</Text>
          <Text style={styles.subtitle}>
            Choose gender filter requires VIP. Upgrade to unlock exclusive features:
          </Text>

          {/* Features */}
          <View style={styles.featureList}>
            <View style={styles.featureRow}>
              <Zap size={18} color="#FACC15" />
              <Text style={styles.featureText}>Unlimited 1-on-1 direct video calls</Text>
            </View>
            <View style={styles.featureRow}>
              <Video size={18} color="#22C55E" />
              <Text style={styles.featureText}>Higher chance to match with your chosen gender</Text>
            </View>
            <View style={styles.featureRow}>
              <ShieldCheck size={18} color="#3B82F6" />
              <Text style={styles.featureText}>VIP badge on your profile card</Text>
            </View>
          </View>

          {/* Plan cards */}
          <TouchableOpacity style={styles.planCard} onPress={handleSubscribe} activeOpacity={0.75}>
            <View>
              <Text style={styles.planName}>Basic VIP</Text>
              <Text style={styles.planPrice}>$2.49 / week</Text>
            </View>
            <Star size={22} color="#A1A1AA" />
          </TouchableOpacity>
          <View style={[styles.planCard, styles.premiumCard]}>
            <View>
              <Text style={styles.planName}>Premium VIP</Text>
              <Text style={styles.planPrice}>$9.99 / month</Text>
            </View>
            <Star size={22} color="#FACC15" fill="#FACC15" />
          </View>

          {/* CTA */}
          <TouchableOpacity style={styles.subscribeButton} onPress={handleSubscribe}>
            <Text style={styles.subscribeText}>Subscribe Now →</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: '#1E1E38',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#2A2A4A',
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  icon: {
    marginTop: 8,
    marginBottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#A1A1AA',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  featureList: {
    width: '100%',
    marginBottom: 20,
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
  },
  planCard: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2A4A',
    marginBottom: 10,
  },
  premiumCard: {
    borderColor: '#FACC15',
    backgroundColor: 'rgba(250, 204, 21, 0.05)',
  },
  planName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  planPrice: {
    color: '#A1A1AA',
    fontSize: 13,
  },
  subscribeButton: {
    backgroundColor: '#EF4444',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 100,
    alignItems: 'center',
    marginTop: 6,
  },
  subscribeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});