import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Animated,
  Text,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import {
  X,
  Sparkles,
  TrendingUp,
  Gift,
  Eye,
  Star,
  Zap,
  Crown,
} from 'lucide-react-native';

// ─── Upsell Modal ─────────────────────────────────────────────────────────────
function VipUpsellModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<'weekly' | 'monthly'>('weekly');

  const perks = [
    { icon: <TrendingUp size={20} color="#22C55E" />, title: 'Stay at the top', desc: 'Your profile appears first in Discover — more eyes on you 24/7.' },
    { icon: <Gift size={20} color="#FACC15" />, title: 'Get gifted more', desc: 'VIP girls receive 3x more gifts from guys who want to impress them.' },
    { icon: <Eye size={20} color="#A78BFA" />, title: 'Thousands of guys see you', desc: 'Boosted visibility means more direct calls, DMs, and gifts every day.' },
    { icon: <Star size={20} color="#F472B6" />, title: 'VIP badge on your profile', desc: 'Stand out instantly — guys know VIP girls are the real deal.' },
    { icon: <Zap size={20} color="#EF4444" />, title: 'Unlimited direct calls', desc: 'Guys with VIP can call you anytime — more connections = more gifts.' },
    { icon: <Crown size={20} color="#FACC15" />, title: 'Pin your socials', desc: 'Showcase your Instagram, TikTok & Discord to your admirers.' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          {/* Close */}
          <TouchableOpacity style={modal.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <X size={22} color="#71717A" />
          </TouchableOpacity>

          {/* Header gradient */}
          <LinearGradient
            colors={['#22C55E', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={modal.header}
          >
            <Text style={modal.headerEmoji}>👑</Text>
            <Text style={modal.headerTitle}>VIP for Girls</Text>
            <Text style={modal.headerSub}>Get noticed. Get gifted. Get paid.</Text>
          </LinearGradient>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={modal.body}>
            {/* Why you need this */}
            <Text style={modal.sectionTitle}>Why female VIPs earn more 💸</Text>
            <Text style={modal.sectionDesc}>
              Guys on C24 Club are actively looking to video chat and gift female users. VIP puts you front and centre so they find{' '}
              <Text style={{ color: '#EC4899', fontWeight: '800' }}>you first.</Text>
            </Text>

            {/* Perks */}
            <Text style={[modal.sectionTitle, { marginTop: 20 }]}>What you get ✨</Text>
            {perks.map((perk, i) => (
              <View key={i} style={modal.perkRow}>
                <View style={modal.perkIcon}>{perk.icon}</View>
                <View style={modal.perkText}>
                  <Text style={modal.perkTitle}>{perk.title}</Text>
                  <Text style={modal.perkDesc}>{perk.desc}</Text>
                </View>
              </View>
            ))}

            {/* Pricing */}
            <Text style={[modal.sectionTitle, { marginTop: 24 }]}>Choose your plan 🌟</Text>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setSelectedPlan('weekly')}>
              <View style={[modal.planCard, selectedPlan === 'weekly' && modal.planSelected]}>
                <View>
                  <Text style={modal.planName}>Basic VIP</Text>
                  <Text style={modal.planPrice}>$2.49 / week</Text>
                  <Text style={modal.planSub}>Cancel anytime</Text>
                </View>
                <Star size={28} color={selectedPlan === 'weekly' ? '#22C55E' : '#A1A1AA'} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setSelectedPlan('monthly')}>
              <View style={[modal.planCard, modal.planPremium, selectedPlan === 'monthly' && modal.planPremiumSelected]}>
                <View>
                  <Text style={modal.planName}>Premium VIP</Text>
                  <Text style={modal.planPrice}>$9.99 / month</Text>
                  <Text style={modal.planSub}>Best value · Save 60%</Text>
                </View>
                <Crown size={28} color="#FACC15" />
              </View>
            </TouchableOpacity>
          </ScrollView>

          {/* CTA */}
          <View style={modal.footer}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                onClose();
                router.push('/vip');
              }}
            >
              <LinearGradient
                colors={['#22C55E', '#EC4899']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={modal.ctaBtn}
              >
                <Text style={modal.ctaText}>
                  {selectedPlan === 'weekly'
                    ? 'Get VIP — $2.49/wk →'
                    : 'Get VIP — $9.99/mo →'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Banner ───────────────────────────────────────────────────────────────────
export function FemaleVipBanner() {
  const { profile, minutes } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const shimmer = useRef(new Animated.Value(0)).current;

  const isFemale = profile?.gender?.toLowerCase() === 'female';
  const isVip = minutes?.is_vip;

  console.log("[FemaleVipBanner] profile.gender:", profile?.gender, "isVip:", isVip);

  // Shimmer animation on the sparkle icon
  useEffect(() => {
    if (!isFemale || isVip) return;
    
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isFemale, isVip]);

  if (!isFemale || isVip) return null;

  const sparkleOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <View style={banner.outer}>
      <TouchableOpacity activeOpacity={0.88} onPress={() => setModalVisible(true)}>
        <View style={banner.container}>
          <Text style={{ fontSize: 14 }}>👑</Text>
          <View style={banner.textWrap}>
            <Text style={banner.text}>
              Get noticed & gifted by thousands of guys — stay at the top of the Discover page with{' '}
              <Text style={banner.bold}>VIP starting at $2.49/week!</Text>
            </Text>
          </View>
          <Animated.View style={{ opacity: sparkleOpacity }}>
            <Sparkles size={14} color="#FFFFFF" />
          </Animated.View>
        </View>
      </TouchableOpacity>

      <VipUpsellModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const banner = StyleSheet.create({
  outer: {
    width: '100%',
  },
  container: {
    backgroundColor: '#C2185B',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 10,
  },
  textWrap: {
    flex: 1,
    marginHorizontal: 8,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
  },
  bold: {
    fontWeight: '800',
    color: '#FACC15',
  },
});

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1A1A2E',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  headerEmoji: {
    fontSize: 40,
    marginBottom: 6,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  headerSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    marginTop: 4,
    textAlign: 'center',
  },
  body: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 8,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },
  sectionDesc: {
    color: '#A1A1AA',
    fontSize: 14,
    lineHeight: 21,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  perkIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1E1E38',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  perkText: {
    flex: 1,
  },
  perkTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  perkDesc: {
    color: '#A1A1AA',
    fontSize: 13,
    lineHeight: 18,
  },
  planCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E1E38',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2A2A4A',
  },
  planPremium: {
    borderColor: '#FACC15',
    backgroundColor: 'rgba(250,204,21,0.05)',
  },
  planSelected: {
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34,197,94,0.1)',
  },
  planPremiumSelected: {
    borderColor: '#FACC15',
    backgroundColor: 'rgba(250,204,21,0.1)',
  },
  planName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  planPrice: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  planSub: {
    color: '#71717A',
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A2A4A',
  },
  ctaBtn: {
    borderRadius: 100,
    paddingVertical: 17,
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});