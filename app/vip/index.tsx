import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  CheckCircle2,
  X,
  Users,
  Zap,
  TrendingUp,
  Video,
  Gift,
  Pin,
  Star,
  Dices,
  Clock,
  RotateCcw,
  FastForward,
  ChevronLeft,
} from 'lucide-react-native';
import {
  initConnection,
  getSubscriptions,
  requestSubscription,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  endConnection,
} from '@/lib/iap-import';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { IAP_SUBSCRIPTIONS } from '@/lib/iap';
import { FooterLinks } from '@/components/FooterLinks';

const BASIC_PRICE_ID = 'price_1T9ygOA5n8uAZoY1tzoTfeMH';
const PREMIUM_PRICE_ID = 'price_1T9yhEA5n8uAZoY1zwb5wVdp';

const BASIC_FEATURES = [
  { icon: Users, label: 'Choose Gender' },
  { icon: Zap, label: 'Auto-unfreeze minutes' },
  { icon: TrendingUp, label: 'Top of Discover Feed' },
  { icon: Video, label: 'Video Call & DM Females' },
];

const PREMIUM_FEATURES = [
  ...BASIC_FEATURES,
  { icon: Gift, label: 'Get Gifted by Anyone' },
  { icon: Pin, label: 'Pin Socials On Screen' },
  { icon: Star, label: 'Spin Legendary Items' },
  { icon: Dices, label: 'Increase Spin Luck' },
  { icon: Clock, label: '30-min Call Cap' },
  { icon: RotateCcw, label: '2nd Spin Attempt' },
  { icon: FastForward, label: 'No Quick Skip Penalty' },
];

export default function VipUpsellScreen() {
  const router = useRouter();
  const { highlight } = useLocalSearchParams<{ highlight?: string }>();
  const { minutes, syncVipStatus, refreshProfile } = useAuth();
  const [loadingPrice, setLoadingPrice] = useState<string | null>(null);
  const offerTokensRef = useRef<Record<string, string>>({});

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isGiftingHighlight = highlight === 'gifting';

  useEffect(() => {
    if (!isGiftingHighlight) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [isGiftingHighlight]);

  // IAP setup
  useEffect(() => {
    if (Platform.OS === 'web') return;

    let purchaseUpdateSub: any;
    let purchaseErrorSub: any;

    const setup = async () => {
      try {
        await initConnection();
        const subs = await getSubscriptions({ skus: [IAP_SUBSCRIPTIONS.BASIC_VIP, IAP_SUBSCRIPTIONS.PREMIUM_VIP] });

        // Store offerTokens for Android (needed for v14 requestPurchase)
        if (Platform.OS === 'android' && Array.isArray(subs)) {
          subs.forEach((sub: any) => {
            const offerDetails = sub.subscriptionOfferDetailsAndroid;
            if (Array.isArray(offerDetails) && offerDetails.length > 0) {
              offerTokensRef.current[sub.productId ?? sub.id] = offerDetails[0].offerToken;
            }
          });
        }

        purchaseUpdateSub = purchaseUpdatedListener(async (purchase) => {
          const { productId, transactionReceipt, purchaseToken } = purchase as any;
          if (!transactionReceipt && !purchaseToken) return;

          try {
            const token = Platform.OS === 'android' ? purchaseToken : transactionReceipt;
            const { data, error } = await supabase.functions.invoke('iap-purchases', {
              body: { action: 'verify-subscription', sku: productId, purchaseToken: token, platform: Platform.OS },
            });
            if (error) throw error;
            if (data?.success) {
              await finishTransaction({ purchase, isConsumable: false });
              await refreshProfile();
              Alert.alert('🎉 Welcome to VIP!', 'Your subscription is now active.');
              router.back();
            } else {
              throw new Error(data?.error || 'Verification failed');
            }
          } catch (err: any) {
            Alert.alert('Purchase Error', err.message || 'Could not verify purchase.');
          } finally {
            setLoadingPrice(null);
          }
        });

        purchaseErrorSub = purchaseErrorListener((error: any) => {
          if (error?.code !== 'E_USER_CANCELLED') {
            Alert.alert('Purchase Failed', error?.message || 'Something went wrong.');
          }
          setLoadingPrice(null);
        });
      } catch (err) {
        console.warn('IAP init error:', err);
      }
    };

    setup();

    return () => {
      purchaseUpdateSub?.remove();
      purchaseErrorSub?.remove();
      endConnection();
    };
  }, []);

  const handlePurchase = async (sku: string) => {
    if (Platform.OS === 'web') {
      Alert.alert('Mobile Only', 'Subscriptions are only available on the mobile app.');
      return;
    }
    setLoadingPrice(sku);
    try {
      const offerToken = offerTokensRef.current[sku];

      if (Platform.OS === 'android' && !offerToken) {
        Alert.alert(
          'Not Available Yet',
          'This subscription is not available right now. Please try again in a few minutes.',
        );
        setLoadingPrice(null);
        return;
      }

      if (Platform.OS === 'android') {
        await requestSubscription({
          request: {
            google: {
              skus: [sku],
              subscriptionOffers: [{ sku, offerToken: offerToken! }],
            },
          },
          type: 'subs',
        });
      } else {
        await requestSubscription({
          request: {
            apple: {
              sku,
              andDangerouslyFinishTransactionAutomatically: false,
            },
          },
          type: 'subs',
        });
      }
    } catch (err: any) {
      if (err?.code !== 'E_USER_CANCELLED') {
        Alert.alert('Error', err?.message || 'Could not initiate purchase.');
      }
      setLoadingPrice(null);
    }
  };

  const currentTier = minutes?.vip_tier;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color="#FFFFFF" size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>VIP Membership</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isGiftingHighlight && (
          <Animated.View style={[styles.giftingBanner, { transform: [{ scale: pulseAnim }] }]}>
            <Gift size={20} color="#1A1A2E" />
            <Text style={styles.giftingBannerText}>
              Guys can send you cash gifts when you're Premium VIP 💸
            </Text>
          </Animated.View>
        )}

        <View style={styles.heroSection}>
          <Star size={48} color="#FACC15" fill="#FACC15" />
          <Text style={styles.heroTitle}>Level Up Your Experience</Text>
          <Text style={styles.heroSubtitle}>Unlock exclusive features and maximize your rewards.</Text>
        </View>

        {/* Premium Card */}
        <View style={[styles.card, styles.premiumCard, isGiftingHighlight && styles.premiumCardHighlighted]}>
          <View style={styles.badgeContainer}>
            <View style={styles.bestValueBadge}>
              <Text style={styles.bestValueText}>BEST VALUE</Text>
            </View>
          </View>

          <View style={styles.cardHeader}>
            <Text style={styles.tierName}>PREMIUM VIP</Text>
            <View style={styles.priceRow}>
              <Text style={styles.currency}>$</Text>
              <Text style={styles.price}>9.99</Text>
              <Text style={styles.interval}>/month</Text>
            </View>
          </View>

          <View style={styles.featuresList}>
            {PREMIUM_FEATURES.map((f, i) => (
              <View
                key={i}
                style={[
                  styles.featureItem,
                  isGiftingHighlight && f.label === 'Get Gifted by Anyone' && styles.featureItemHighlighted,
                ]}
              >
                <f.icon
                  size={18}
                  color={isGiftingHighlight && f.label === 'Get Gifted by Anyone' ? '#EF4444' : '#FACC15'}
                  style={styles.featureIcon}
                />
                <Text
                  style={[
                    styles.featureLabel,
                    isGiftingHighlight && f.label === 'Get Gifted by Anyone' && styles.featureLabelHighlighted,
                  ]}
                >
                  {f.label}
                </Text>
              </View>
            ))}
          </View>

          {currentTier === 'premium' ? (
            <View style={styles.manageButton}>
              <CheckCircle2 size={20} color="#FFFFFF" />
              <Text style={styles.manageButtonText}>YOUR ACTIVE PLAN</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.premiumButton}
              onPress={() => handlePurchase(IAP_SUBSCRIPTIONS.PREMIUM_VIP)}
              disabled={!!loadingPrice}
            >
              {loadingPrice === IAP_SUBSCRIPTIONS.PREMIUM_VIP ? (
                <ActivityIndicator color="#1A1A2E" />
              ) : (
                <Text style={styles.premiumButtonText}>GET PREMIUM</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Basic Card */}
        <View style={[styles.card, styles.basicCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.tierName}>BASIC VIP</Text>
            <View style={styles.priceRow}>
              <Text style={styles.currency}>$</Text>
              <Text style={styles.price}>2.49</Text>
              <Text style={styles.interval}>/week</Text>
            </View>
          </View>

          <View style={styles.featuresList}>
            {BASIC_FEATURES.map((f, i) => (
              <View key={i} style={styles.featureItem}>
                <f.icon size={18} color="#22C55E" style={styles.featureIcon} />
                <Text style={styles.featureLabel}>{f.label}</Text>
              </View>
            ))}
          </View>

          {currentTier === 'basic' ? (
            <View style={styles.manageButton}>
              <CheckCircle2 size={20} color="#FFFFFF" />
              <Text style={styles.manageButtonText}>YOUR ACTIVE PLAN</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.basicButton}
              onPress={() => handlePurchase(IAP_SUBSCRIPTIONS.BASIC_VIP)}
              disabled={!!loadingPrice || currentTier === 'premium'}
            >
              {loadingPrice === IAP_SUBSCRIPTIONS.BASIC_VIP ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.basicButtonText}>
                  {currentTier === 'premium' ? 'INCLUDED IN PREMIUM' : 'GET BASIC'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.footerText}>
          {Platform.OS === 'web'
            ? 'Subscriptions are available on the mobile app.'
            : 'Subscription auto-renews. Cancel anytime in your device settings.'}
        </Text>

        <FooterLinks />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    marginVertical: 24,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 16,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#A1A1AA',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#1E1E38',
    borderRadius: 30,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
  },
  basicCard: {
    borderColor: '#22C55E',
  },
  premiumCard: {
    borderColor: '#FACC15',
    backgroundColor: '#25254A',
  },
  badgeContainer: {
    position: 'absolute',
    top: -12,
    right: 24,
  },
  bestValueBadge: {
    backgroundColor: '#FACC15',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bestValueText: {
    color: '#1A1A2E',
    fontSize: 12,
    fontWeight: '900',
  },
  cardHeader: {
    marginBottom: 24,
  },
  tierName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#A1A1AA',
    letterSpacing: 1.5,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  currency: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  price: {
    fontSize: 40,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  interval: {
    fontSize: 16,
    color: '#A1A1AA',
    marginLeft: 4,
  },
  featuresList: {
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  featureIcon: {
    marginRight: 12,
  },
  featureLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  basicButton: {
    backgroundColor: '#22C55E',
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: 'center',
  },
  basicButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  premiumButton: {
    backgroundColor: '#FACC15',
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: 'center',
  },
  premiumButtonText: {
    color: '#1A1A2E',
    fontSize: 16,
    fontWeight: '800',
  },
  manageButton: {
    backgroundColor: 'transparent',
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    rowGap: 8, columnGap: 8,
  },
  manageButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  footerText: {
    fontSize: 12,
    color: '#71717A',
    textAlign: 'center',
    marginTop: 8,
  },
  giftingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FACC15',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    columnGap: 10,
    rowGap: 10,
  },
  giftingBannerText: {
    flex: 1,
    color: '#1A1A2E',
    fontWeight: '800',
    fontSize: 13,
    lineHeight: 18,
  },
  premiumCardHighlighted: {
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  featureItemHighlighted: {
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginHorizontal: -8,
  },
  featureLabelHighlighted: {
    color: '#EF4444',
    fontWeight: '800',
  },
});