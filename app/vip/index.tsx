/**
 * app/vip/index.tsx
 *
 * VIP Membership upsell screen — clean rewrite.
 *
 * State machine:
 *   idle → connecting → ready → purchasing → (done, back to ready)
 *                     ↘ error  (retry button shown)
 *
 * Purchase flow:
 *   1. On mount: initConnection() + getSubscriptions() to register SKUs with StoreKit/Play.
 *   2. User taps buy → requestSubscription() → StoreKit sheet appears.
 *   3. Global useIAPListener (mounted in _layout.tsx) catches purchaseUpdatedListener,
 *      calls edge function verify-subscription, finishes the transaction, and refreshes profile.
 *   4. Local purchaseUpdatedListener here watches for the same event to clear loading
 *      and show the success alert on this screen.
 *
 * Key rules:
 *   - Buttons only disabled while status === 'purchasing' or user is already that tier.
 *   - E_ALREADY_OWNED → auto-restore + show info message.
 *   - E_USER_CANCELLED → silently reset to ready, no alert.
 *   - Any other error → Alert with message + code.
 *   - NEVER call endConnection().
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Animated,
  Dimensions,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  CheckCircle2,
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
  AlertCircle,
  RefreshCw,
  ExternalLink,
  HelpCircle,
  CircleCheck,
  ShieldCheck,
} from 'lucide-react-native';
import {
  initConnection,
  getSubscriptions,
  requestSubscription,
  purchaseUpdatedListener,
  purchaseErrorListener,
  getAvailablePurchases,
  Subscription,
} from '@/lib/iap-import';
import { supabase } from "@/lib/supabase";
import { invokeIAP, getIAPOriginalTransactionId, getIAPSubscriptionEnd } from "@/lib/iap-supabase";
import { useAuth } from '@/contexts/AuthContext';
import { IAP_SUBSCRIPTIONS } from '@/lib/iap';
import { FooterLinks } from '@/components/FooterLinks';
import { flattenStyle } from '@/utils/flatten-style';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import { Button, ButtonText, ButtonIcon, ButtonSpinner } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";

// ── Feature definitions ──────────────────────────────────────────────────────

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

// ── Screen status type ───────────────────────────────────────────────────────

type ScreenStatus =
  | 'idle'        // before setup starts
  | 'connecting'  // initConnection + getSubscriptions in progress
  | 'ready'       // products registered, buttons active
  | 'purchasing'  // requestSubscription called, waiting for StoreKit
  | 'error';      // setup failed, show retry

// ── Component ────────────────────────────────────────────────────────────────

export default function VipUpsellScreen() {
  const router = useRouter();
  const { highlight } = useLocalSearchParams<{ highlight?: string }>();
  const { minutes, refreshProfile, syncVipStatus, user, updateMinutesFromRow } = useAuth();

  // Screen-level state machine
  const [status, setStatus] = useState<ScreenStatus>('idle');
  const [setupError, setSetupError] = useState<string | null>(null);

  // Store-fetched products (for localized prices and availability check)
  const [storeProducts, setStoreProducts] = useState<Subscription[]>([]);

  // Which SKU is currently being purchased (so we can show the right button spinner)
  const [purchasingSku, setPurchasingSku] = useState<string | null>(null);

  // Restoring purchases
  const [restoring, setRestoring] = useState(false);
  
  // Success / Activation modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);

  // Android: offer tokens are required when calling requestSubscription
  const offerTokensRef = useRef<Record<string, string>>({});

  // Safety valve: if the StoreKit sheet never fires purchaseUpdated/Error, clear loading after 45s
  const purchaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Gifting highlight animation ──────────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isGiftingHighlight = highlight === 'gifting';

  useEffect(() => {
    if (!isGiftingHighlight) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isGiftingHighlight]);

  // ── IAP setup ────────────────────────────────────────────────────────────
  const runSetup = useCallback(async () => {
    if (Platform.OS === 'web') return;

    setStatus('connecting');
    setSetupError(null);

    try {
      // Step 1: Connect to the store. Idempotent — safe even if global listener already called it.
      await initConnection();
      console.log('[VIP] initConnection OK');

      // Step 2: Register SKUs with StoreKit / Play Billing.
      // This is required before requestSubscription will trigger the native sheet.
      const skus = [IAP_SUBSCRIPTIONS.BASIC_VIP, IAP_SUBSCRIPTIONS.PREMIUM_VIP];
      console.log('[VIP] Requesting SKUs from store:', skus);
      const subs = await getSubscriptions({ skus });
      
      const foundSkus = subs?.map((s: any) => s.productId ?? s.id) ?? [];
      console.log('[VIP] Store returned products for SKUs:', foundSkus);

      if (subs && subs.length > 0) {
        setStoreProducts(subs);
      }

      if (!subs || subs.length === 0) {
        throw new Error('No products returned from the store. Check SKU configuration.');
      }

      // Step 3 (Android only): cache offer tokens — required by Google Play Billing v5+
      if (Platform.OS === 'android') {
        subs.forEach((sub: any) => {
          const productId: string = sub.productId ?? sub.id;
          const offerDetails = sub.subscriptionOfferDetailsAndroid;
          if (Array.isArray(offerDetails) && offerDetails.length > 0) {
            offerTokensRef.current[productId] = offerDetails[0].offerToken;
            console.log('[VIP] Cached offer token for:', productId);
          }
        });
      }

      setStatus('ready');
      console.log('[VIP] Setup complete — ready to purchase');
    } catch (err: any) {
      console.warn('[VIP] Setup error:', err?.message);
      setSetupError(err?.message ?? 'Unknown error');
      setStatus('error');
    }
  }, []);

  // ── Mount: setup + local listeners ───────────────────────────────────────
  useEffect(() => {
    // Start setup immediately
    runSetup();

    // Local purchaseUpdatedListener — complements the global one in useIAPListener.
    // Its sole job here is to clear the local purchasing state on this screen 
    // when the user's purchase comes through. The actual verification and 
    // finishing is handled by the global useIAPListener.
    const updateSub = purchaseUpdatedListener((purchase: any) => {
      const sku: string = purchase?.productId ?? '';
      console.log('[VIP] purchaseUpdatedListener (local) fired for SKU:', sku);

      const skuLower = sku.toLowerCase();
      const isOurSku =
        skuLower === IAP_SUBSCRIPTIONS.BASIC_VIP.toLowerCase() || 
        skuLower === IAP_SUBSCRIPTIONS.PREMIUM_VIP.toLowerCase();

      if (isOurSku) {
        clearPurchaseTimeout();

        // Clear any potential caches (redundant with global but safe)
        if (user?.id) {
          AsyncStorage.removeItem(`vip_status_${user.id}`).catch(() => {});
        }

        // Show the success/activation modal as requested
        setShowSuccessModal(true);
      }
    });

    // Local purchaseErrorListener — mirrors what the global listener sees,
    // but handles UI state (clearing spinner, showing alert) specific to this screen.
    const errorSub = purchaseErrorListener((error: any) => {
      const code: string = error?.code ?? '';
      const message: string = error?.message ?? 'Unknown error';
      console.log('[VIP] purchaseErrorListener (local) fired:', code, message);

      clearPurchaseTimeout();
      setPurchasingSku(null);
      setStatus('ready');

      if (code === 'E_USER_CANCELLED') {
        // Silent — user dismissed the sheet intentionally
        return;
      }

      const messageLower = message.toLowerCase();
      if (code === 'E_ALREADY_OWNED' || messageLower.includes('already owned') || messageLower.includes('duplicate')) {
        // User already has this subscription but the app doesn't reflect it yet.
        // Show the success modal to force the "Sync & Activate" step
        setShowSuccessModal(true);
        return;
      }

      Alert.alert(
        'Purchase Error',
        `${message}\n\nCode: ${code || 'none'}`,
        [{ text: 'OK' }]
      );
    });

    return () => {
      updateSub?.remove();
      errorSub?.remove();
      clearPurchaseTimeout();
    };
  }, [runSetup]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen to VIP status changes to clear the loading state and show success alert
  useEffect(() => {
    const isNowVip = minutes?.is_vip || minutes?.admin_granted_vip;
    if (isNowVip && (purchasingSku || showSuccessModal)) {
      console.log('[VIP] VIP status activated! Clearing purchasing state.');
      setPurchasingSku(null);
      setStatus('ready');
      clearPurchaseTimeout();
      setShowSuccessModal(false);
      
      // Final confirmation
      setTimeout(() => {
        Alert.alert(
          '🎉 VIP Active!',
          "Your subscription is now fully active. Enjoy your VIP perks!",
          [{ text: 'Awesome!', onPress: () => router.back() }]
        );
      }, 500);
    }
  }, [minutes?.is_vip, minutes?.admin_granted_vip, purchasingSku, router, showSuccessModal]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const clearPurchaseTimeout = () => {
    if (purchaseTimeoutRef.current) {
      clearTimeout(purchaseTimeoutRef.current);
      purchaseTimeoutRef.current = null;
    }
  };

  // ── Purchase handler ─────────────────────────────────────────────────────
  const handlePurchase = async (sku: string) => {
    console.log('[VIP] handlePurchase called for SKU:', sku);

    if (Platform.OS === 'web') {
      Alert.alert('Mobile Only', 'Subscriptions are only available on the mobile app.');
      return;
    }

    if (status === 'purchasing') return; // already in flight

    // Verify product is actually available in store cache
    const product = storeProducts.find(p => (p.productId ?? (p as any).id) === sku);
    
    if (!product && Platform.OS !== 'web') {
      Alert.alert(
        'Item Not Found',
        `The product "${sku}" could not be retrieved from the App Store. Please ensure it is approved and cleared for sale in App Store Connect.`,
        [{ text: 'OK' }]
      );
      return;
    }

    // Android: we need the offer token to proceed
    if (Platform.OS === 'android' && product) {
      const token = offerTokensRef.current[sku];
      if (!token) {
        Alert.alert(
          'Not Ready',
          'Subscription offer not ready. Please wait a moment and try again.'
        );
        return;
      }
    }

    setStatus('purchasing');
    setPurchasingSku(sku);

    // Safety timeout: if neither listener fires in 45s, unlock the buttons
    clearPurchaseTimeout();
    purchaseTimeoutRef.current = setTimeout(() => {
      console.warn('[VIP] Purchase timeout — clearing state');
      setPurchasingSku(null);
      setStatus('ready');
    }, 45_000);

    try {
      if (Platform.OS === 'ios') {
        await requestSubscription({
          request: { apple: { sku } },
        });
      } else {
        const offerToken = offerTokensRef.current[sku];
        await requestSubscription({
          request: {
            google: {
              skus: [sku],
              subscriptionOffers: [{ sku, offerToken }],
            },
          },
        });
      }
      // requestSubscription resolving means the sheet was shown and the purchase
      // was queued. The actual result comes via purchaseUpdatedListener / purchaseErrorListener.
      console.log('[VIP] requestSubscription resolved (sheet shown / queued)');
    } catch (err: any) {
      // On iOS, errors from requestSubscription are also delivered via purchaseErrorListener,
      // so we may get a double-fire. Guard by checking if we're still in 'purchasing' state.
      const code: string = err?.code ?? '';
      const message: string = err?.message ?? 'Unknown error';
      console.warn('[VIP] requestSubscription threw:', code, message);

      clearPurchaseTimeout();
      setPurchasingSku(null);
      setStatus('ready');

      if (code === 'E_USER_CANCELLED') return;

      if (code === 'E_ALREADY_OWNED' || message.toLowerCase().includes('already owned') || message.toLowerCase().includes('duplicate')) {
        setShowSuccessModal(true);
        return;
      }

      Alert.alert('Purchase Error', `${message}\n\nCode: ${code || 'none'}`);
    }
  };

  // ── Restore purchases ────────────────────────────────────────────────────
  const handleRestore = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Mobile Only', 'Subscriptions are only available on the mobile app.');
      return;
    }

    setRestoring(true);
    console.log('[VIP] Restoring purchases — fetching available purchases from store...');

    try {
      // Step 1: Get all purchases from the store that haven't been consumed/finished
      const purchases = await getAvailablePurchases();
      console.log('[VIP] Available purchases:', purchases?.length, purchases?.map((p: any) => p.productId));

      if (!purchases || purchases.length === 0) {
        const storeAccount = Platform.OS === 'ios' ? 'Apple ID' : 'Google Play account';
        Alert.alert('No Active Subscription', `No active VIP subscription was found on this ${storeAccount}. If you believe this is an error, please contact support.`);
        setRestoring(false);
        return;
      }

      // Step 2: Find the most recent VIP subscription in the list
      const VIP_SKUS = [IAP_SUBSCRIPTIONS.BASIC_VIP, IAP_SUBSCRIPTIONS.PREMIUM_VIP];
      const vipPurchase = purchases.find((p: any) => VIP_SKUS.includes(p.productId));

      // All known iOS VIP SKU variants (case-insensitive match)
      const ALL_VIP_SKUS_LOWER = ['basicvip', 'premiumvip', 'c24_basic_vip', 'c24_premium_vip'];
      const vipPurchase2 = !vipPurchase
        ? purchases.find((p: any) => ALL_VIP_SKUS_LOWER.includes((p.productId ?? '').toLowerCase()))
        : null;
      const resolvedPurchase = vipPurchase ?? vipPurchase2;

      if (!vipPurchase) {
        // strict match failed — try case-insensitive fallback (resolvedPurchase)
      }
      // resolvedPurchase is guaranteed non-null here (vipPurchase is non-null implies resolvedPurchase is non-null)
      // Log and continue
      // (moved log below resolvedPurchase null check)
      if (!resolvedPurchase) {

        const storeAccount = Platform.OS === 'ios' ? 'Apple ID' : 'Google Play account';
        Alert.alert('No Active Subscription', `No active VIP subscription was found on this ${storeAccount}. If you believe this is an error, contact support.`);
        setRestoring(false);
        return;
      }
      console.log('[VIP] productIds from Apple:', purchases.map((p: any) => p.productId), '| using:', resolvedPurchase.productId);
      // rn-iap v14 (StoreKit 2): purchaseToken is the unified receipt field.
      // transactionReceipt no longer exists — purchaseToken is the unified field.
      const finalToken = resolvedPurchase.purchaseToken
        ?? (resolvedPurchase as any).transactionReceipt
        ?? (resolvedPurchase as any).transactionId
        ?? 'ios-restore';
      console.log('[VIP] Restoring SKU:', resolvedPurchase.productId, '| token present:', finalToken !== 'ios-restore');
      const originalTransactionId = getIAPOriginalTransactionId(resolvedPurchase as Record<string, unknown>);
      const subscriptionEnd = getIAPSubscriptionEnd(resolvedPurchase as Record<string, unknown>);
      // Step 3: Send to backend to activate VIP in DB.
    setActivationError(null);
      const { data, error } = await invokeIAP({
        action: 'verify-subscription',
        sku: resolvedPurchase.productId,
        purchaseToken: finalToken,
        platform: Platform.OS,
        transactionId: (resolvedPurchase as any).transactionId ?? finalToken,
        original_transaction_id: originalTransactionId,
        subscription_end: subscriptionEnd,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Restore failed');

      console.log('[VIP] Restore successful via verify-subscription');

      // Step 4: Update local state immediately from response
      if (data.member_minutes) {
        console.log('[VIP] Updating minutes immediately from restore response row');
        updateMinutesFromRow(data.member_minutes);
      } else {
        await refreshProfile();
      }

      // Determine tier from the SKU we just verified
      const restoredTier = (['premiumvip', 'c24_premium_vip'].includes((resolvedPurchase.productId ?? '').toLowerCase())) ? 'Premium' : 'Basic';
      Alert.alert('✅ VIP Restored', `Your ${restoredTier} VIP subscription has been restored!`);
      setShowSuccessModal(false);

      // (resolvedPurchase used above via vipPurchase — kept for reference)
    } catch (err: any) {
      console.error('[VIP] Restore error:', err);
      setActivationError(err?.message ?? 'An unexpected error occurred. Please contact support.');
      // Only show alert if NOT in success modal (as success modal has its own error display)
      if (!showSuccessModal) {
        Alert.alert('Restore Failed', err?.message ?? 'An unexpected error occurred. Please contact support.');
      }
    } finally {
      setRestoring(false);
    }
  };

  // ── Restore purchases (replaced above) ──────────────────────────────────


  // ── Derived state ────────────────────────────────────────────────────────
  const currentTier = minutes?.vip_tier ?? null;
  const isPurchasing = status === 'purchasing';

  // Localized price helpers
  const getSubData = (sku: string) => {
    const sub = storeProducts.find(s => (s.productId ?? (s as any).id) === sku);
    return sub;
  };

  const premiumSub = getSubData(IAP_SUBSCRIPTIONS.PREMIUM_VIP);
  const basicSub = getSubData(IAP_SUBSCRIPTIONS.BASIC_VIP);
  
  // If we found the product, we use the store's localized price.
  // Otherwise we fall back to hardcoded defaults (useful for development/preview).
  const premiumPrice = premiumSub?.localizedPrice ?? '9.99';
  const basicPrice = basicSub?.localizedPrice ?? '2.49';
  
  const isPremiumAvailable = !!premiumSub || Platform.OS === 'web';
  const isBasicAvailable = !!basicSub || Platform.OS === 'web';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color="#FFFFFF" size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>VIP Membership</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Gifting highlight banner — animated pulse when highlight==='gifting' */}
        {isGiftingHighlight && (
          <Animated.View
            style={flattenStyle([styles.giftingBanner, { transform: [{ scale: pulseAnim }] }])}
          >
            <Gift size={20} color="#1A1A2E" />
            <Text style={styles.giftingBannerText}>
              Premium VIPs can receive community support and rewards 🎁
            </Text>
          </Animated.View>
        )}

        {/* Hero section */}
        <View style={styles.heroSection}>
          <Star size={48} color="#FACC15" fill="#FACC15" />
          <Text style={styles.heroTitle}>Level Up Your Experience</Text>
          <Text style={styles.heroSubtitle}>
            Unlock exclusive features and maximize your rewards.
          </Text>
        </View>

        {/* Error / connecting indicator */}
        {status === 'error' && (
          <TouchableOpacity
            style={styles.errorBanner}
            onPress={runSetup}
            activeOpacity={0.8}
          >
            <AlertCircle size={18} color="#EF4444" />
            <View style={styles.errorBannerText}>
              <Text style={styles.errorBannerTitle}>Store Connection Failed</Text>
              <Text style={styles.errorBannerMessage}>{setupError}</Text>
            </View>
            <RefreshCw size={16} color="#A1A1AA" />
          </TouchableOpacity>
        )}

        {status === 'connecting' && (
          <View style={styles.connectingBanner}>
            <ActivityIndicator color="#FACC15" size="small" />
            <Text style={styles.connectingText}>Connecting to store…</Text>
          </View>
        )}

        {/* ── PREMIUM VIP CARD ── */}
        <View
          style={flattenStyle([
            styles.card,
            styles.premiumCard,
            isGiftingHighlight && styles.premiumCardHighlighted,
          ])}
        >
          {/* BEST VALUE badge */}
          <View style={styles.badgeContainer}>
            <View style={styles.bestValueBadge}>
              <Text style={styles.bestValueText}>BEST VALUE</Text>
            </View>
          </View>

          <View style={styles.cardHeader}>
            <Text style={styles.tierName}>PREMIUM VIP</Text>
            <View style={styles.priceRow}>
              {premiumSub?.localizedPrice ? (
                <Text style={styles.price}>{premiumSub.localizedPrice}</Text>
              ) : (
                <>
                  <Text style={styles.currency}>$</Text>
                  <Text style={styles.price}>9.99</Text>
                  <Text style={styles.interval}>/month</Text>
                </>
              )}
            </View>
          </View>

          <View style={styles.featuresList}>
            {PREMIUM_FEATURES.map((f, i) => {
              const isGiftFeature =
                isGiftingHighlight && f.label === 'Get Gifted by Anyone';
              return (
                <View
                  key={i}
                  style={flattenStyle([
                    styles.featureItem,
                    isGiftFeature && styles.featureItemHighlighted,
                  ])}
                >
                  <f.icon
                    size={18}
                    color={isGiftFeature ? '#EF4444' : '#FACC15'}
                    style={styles.featureIcon}
                  />
                  <Text
                    style={flattenStyle([
                      styles.featureLabel,
                      isGiftFeature && styles.featureLabelHighlighted,
                    ])}
                  >
                    {f.label}
                  </Text>
                </View>
              );
            })}
          </View>

          {currentTier === 'premium' ? (
            <View style={styles.activePlanBadge}>
              <CheckCircle2 size={20} color="#FFFFFF" />
              <Text style={styles.activePlanText}>YOUR ACTIVE PLAN</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={flattenStyle([
                styles.premiumButton,
                (isPurchasing || !isPremiumAvailable) && styles.buttonDisabled,
              ])}
              onPress={() => isPremiumAvailable && handlePurchase(IAP_SUBSCRIPTIONS.PREMIUM_VIP)}
              disabled={isPurchasing || !isPremiumAvailable}
              activeOpacity={0.85}
            >
              {!isPremiumAvailable && status === 'ready' ? (
                <Text style={styles.premiumButtonText}>PLAN UNAVAILABLE</Text>
              ) : purchasingSku === IAP_SUBSCRIPTIONS.PREMIUM_VIP ? (
                <ActivityIndicator color="#1A1A2E" />
              ) : (
                <Text style={styles.premiumButtonText}>GET PREMIUM</Text>
              )}
            </TouchableOpacity>
          )}
          
          {!isPremiumAvailable && status === 'ready' && Platform.OS !== 'web' && (
            <View style={styles.skuDebugInfo}>
              <HelpCircle size={12} color="#EF4444" />
              <Text style={styles.skuDebugText}>
                SKU "{IAP_SUBSCRIPTIONS.PREMIUM_VIP}" not found in store
              </Text>
            </View>
          )}
        </View>

        {/* ── BASIC VIP CARD ── */}
        <View style={flattenStyle([styles.card, styles.basicCard])}>
          <View style={styles.cardHeader}>
            <Text style={styles.tierName}>BASIC VIP</Text>
            <View style={styles.priceRow}>
              {basicSub?.localizedPrice ? (
                <Text style={styles.price}>{basicSub.localizedPrice}</Text>
              ) : (
                <>
                  <Text style={styles.currency}>$</Text>
                  <Text style={styles.price}>2.49</Text>
                  <Text style={styles.interval}>/week</Text>
                </>
              )}
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
            <View style={styles.activePlanBadge}>
              <CheckCircle2 size={20} color="#FFFFFF" />
              <Text style={styles.activePlanText}>YOUR ACTIVE PLAN</Text>
            </View>
          ) : currentTier === 'premium' ? (
            <View style={styles.includedInPremiumBadge}>
              <Text style={styles.includedInPremiumText}>INCLUDED IN PREMIUM</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={flattenStyle([
                styles.basicButton,
                (isPurchasing || !isBasicAvailable) && styles.buttonDisabled,
              ])}
              onPress={() => isBasicAvailable && handlePurchase(IAP_SUBSCRIPTIONS.BASIC_VIP)}
              disabled={isPurchasing || !isBasicAvailable}
              activeOpacity={0.85}
            >
              {!isBasicAvailable && status === 'ready' ? (
                <Text style={styles.basicButtonText}>PLAN UNAVAILABLE</Text>
              ) : purchasingSku === IAP_SUBSCRIPTIONS.BASIC_VIP ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.basicButtonText}>GET BASIC</Text>
              )}
            </TouchableOpacity>
          )}

          {!isBasicAvailable && status === 'ready' && Platform.OS !== 'web' && (
            <View style={styles.skuDebugInfo}>
              <HelpCircle size={12} color="#EF4444" />
              <Text style={styles.skuDebugText}>
                SKU "{IAP_SUBSCRIPTIONS.BASIC_VIP}" not found in store
              </Text>
            </View>
          )}
        </View>

        {/* Footer note */}
        <Text style={styles.footerNote}>
          {Platform.OS === 'web'
            ? 'Subscriptions are available on the mobile app.'
            : 'Subscription auto-renews. Cancel anytime in your device settings.'}
        </Text>

        {/* Restore Purchases */}
        {Platform.OS !== 'web' && (
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
            disabled={restoring || isPurchasing}
            activeOpacity={0.7}
          >
            {restoring ? (
              <ActivityIndicator color="#A1A1AA" size="small" />
            ) : (
              <Text style={styles.restoreButtonText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>
        )}

        <FooterLinks />

        {/* Legal Subscription Info */}
        <View style={styles.legalSection}>
          <Text style={styles.legalText}>
            Payment will be charged to your Apple ID account at the confirmation of purchase. Subscription automatically renews unless it is canceled at least 24 hours before the end of the current period. Your account will be charged for renewal within 24 hours prior to the end of the current period. You can manage and cancel your subscriptions by going to your account settings on the App Store after purchase.
          </Text>
          
          <View style={styles.legalLinksRow}>
            <TouchableOpacity 
              onPress={() => Linking.openURL('https://c24club.com/privacy')}
              style={styles.legalLink}
            >
              <Text style={styles.legalLinkText}>Privacy Policy</Text>
              <ExternalLink size={12} color="#71717A" />
            </TouchableOpacity>
            
            <View style={styles.legalLinkDivider} />
            
            <TouchableOpacity 
              onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}
              style={styles.legalLink}
            >
              <Text style={styles.legalLinkText}>Terms of Use (EULA)</Text>
              <ExternalLink size={12} color="#71717A" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Success / Activation Modal */}
      <Modal 
        isOpen={showSuccessModal} 
        onClose={() => !restoring && setShowSuccessModal(false)} 
        size="md"
      >
        <ModalBackdrop />
        <ModalContent style={{ backgroundColor: '#1A1A2E', borderColor: '#27272A', borderWidth: 1 }}>
          <ModalHeader style={{ borderBottomWidth: 0, paddingTop: 24 }}>
            <View style={{ alignItems: 'center', width: '100%' }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(34,197,94,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <ShieldCheck size={32} color="#22C55E" />
              </View>
              <Heading size="lg" style={{ color: '#FFFFFF', textAlign: 'center' }}>Payment Received!</Heading>
            </View>
          </ModalHeader>
          
          <ModalBody style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
            <Text style={{ color: '#A1A1AA', textAlign: 'center', fontSize: 15, lineHeight: 22, marginBottom: 20 }}>
              To finish activating your VIP perks and unlock the Discover feed, please tap the button below to sync your status with our servers.
            </Text>
            
            {activationError && (
              <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
                <Text style={{ color: '#EF4444', fontSize: 13, textAlign: 'center' }}>{activationError}</Text>
              </View>
            )}

            <Button 
              size="lg" 
              onPress={handleRestore} 
              disabled={restoring}
              style={{ backgroundColor: '#22C55E', borderRadius: 12, height: 56 }}
            >
              {restoring ? <ButtonSpinner color="#FFFFFF" /> : <ButtonText style={{ fontWeight: '800' }}>Sync & Activate VIP</ButtonText>}
            </Button>
            
            {!restoring && (
              <TouchableOpacity 
                onPress={() => setShowSuccessModal(false)}
                style={{ marginTop: 16, paddingVertical: 8, alignItems: 'center' }}
              >
                <Text style={{ color: '#71717A', fontSize: 14 }}>Close</Text>
              </TouchableOpacity>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

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

  // ── Gifting highlight ───────────────────────────────────────────────────
  giftingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FACC15',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 10,
  },
  giftingBannerText: {
    flex: 1,
    color: '#1A1A2E',
    fontWeight: '800',
    fontSize: 13,
  },

  // ── Hero ────────────────────────────────────────────────────────────────
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

  // ── Status banners ──────────────────────────────────────────────────────
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25254A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EF4444',
    gap: 12,
  },
  errorBannerText: {
    flex: 1,
  },
  errorBannerTitle: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 14,
  },
  errorBannerMessage: {
    color: '#A1A1AA',
    fontSize: 12,
    marginTop: 2,
  },
  connectingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    marginBottom: 12,
  },
  connectingText: {
    color: '#A1A1AA',
    fontSize: 14,
  },

  // ── Cards ───────────────────────────────────────────────────────────────
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
  premiumCardHighlighted: {
    borderColor: '#EF4444',
    borderWidth: 2,
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

  // ── Card header ─────────────────────────────────────────────────────────
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

  // ── Features ────────────────────────────────────────────────────────────
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

  // ── Buttons ─────────────────────────────────────────────────────────────
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
  buttonDisabled: {
    opacity: 0.6,
  },

  // ── Active plan / included badges ────────────────────────────────────────
  activePlanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 100,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    gap: 8,
  },
  activePlanText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  includedInPremiumBadge: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  includedInPremiumText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  // ── Debug ───────────────────────────────────────────────────────────────
  skuDebugInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  skuDebugText: {
    fontSize: 10,
    color: '#EF4444',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // ── Footer ───────────────────────────────────────────────────────────────
  footerNote: {
    fontSize: 12,
    color: '#71717A',
    textAlign: 'center',
    marginTop: 8,
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  restoreButtonText: {
    fontSize: 13,
    color: '#A1A1AA',
    textDecorationLine: 'underline',
  },
  legalSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },
  legalText: {
    fontSize: 11,
    color: '#71717A',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 16,
  },
  legalLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  legalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legalLinkText: {
    fontSize: 12,
    color: '#A1A1AA',
    fontWeight: '600',
  },
  legalLinkDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#3F3F46',
  },
});