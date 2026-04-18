import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { redeemReward } from '@/lib/chat-utils';
import { useCallback } from 'react';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  Star, 
  Globe, 
  Coins,
  Lock,
  CheckCircle2,
  X,
  MapPin,
  Edit2
} from 'lucide-react-native';
import { useCEProgress } from "@/hooks/useCEProgress";
import { useToast, Toast, ToastTitle, ToastDescription } from "@/components/ui/toast";
import { Button, ButtonText, ButtonSpinner } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import { Input, InputField } from "@/components/ui/input";
import {
  Checkbox,
  CheckboxIndicator,
  CheckboxIcon,
  CheckboxLabel,
} from "@/components/ui/checkbox";
import { CheckIcon } from "@/components/ui/icon";
import { LinearGradient } from 'expo-linear-gradient';
import { RewardSpinModal } from '@/components/modals/RewardSpinModal';
import { CashoutChoiceModal } from '@/components/modals/CashoutChoiceModal';
import useColorScheme from '@/hooks/useColorScheme';
import { flattenStyle } from '@/utils/flatten-style';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RewardDetail {
  id: string;
  title: string;
  brief: string | null;
  description: string | null;
  image_url: string | null;
  variation_images: string[] | null;
  minutes_cost: number;
  rarity: "common" | "rare" | "legendary" | null;
  type: string | null;
  sizes: string | null;
  ships_to: string[] | null;
  cashout_value: number;
  is_vip_only: boolean;
  color_options: Array<{ name: string; hex: string; image_url?: string }> | null;
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user, profile, minutes, refreshProfile, updateProfile } = useAuth();
  const toast = useToast();
  const isDark = useColorScheme() === 'dark';

  const [item, setItem] = useState<RewardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColorIndex, setSelectedColorIndex] = useState<number | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [liveMinutes, setLiveMinutes] = useState<number | null>(null);

  // Modal states
  const [showSpinModal, setShowSpinModal] = useState(false);
  const [showCashoutModal, setShowCashoutModal] = useState(false);
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [wonRedemptionId, setWonRedemptionId] = useState<string | null>(null);

  // Shipping form state
  const [isUsingSavedAddress, setIsUsingSavedAddress] = useState(true);
  const [shippingAddress, setShippingAddress] = useState({
    name: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    country: '',
  });
  const [saveAsDefault, setSaveAsDefault] = useState(false);

  // Fetch live balance every time screen is focused
  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      supabase.functions.invoke('earn-minutes', {
        body: { type: 'get_balance', userId: user.id },
      }).then(({ data }) => {
        if (data?.totalMinutes !== undefined) setLiveMinutes(data.totalMinutes);
      }).catch(() => {});
    }, [user?.id])
  );

  useEffect(() => {
    if (showShippingModal && profile) {
      // If profile has any address info, default to "Use Saved Address"
      const hasSavedAddress = !!(profile.shipping_address || profile.shipping_city || profile.shipping_name);
      setIsUsingSavedAddress(hasSavedAddress);
      
      setShippingAddress({
        name: profile.shipping_name || '',
        street: profile.shipping_address || '',
        city: profile.shipping_city || '',
        state: profile.shipping_state || '',
        zip: profile.shipping_zip || '',
        country: profile.shipping_country || '',
      });
    }
  }, [showShippingModal, profile]);

  const images = useMemo(() => {
    if (!item) return [];
    if (item.variation_images && item.variation_images.length > 0) {
      return item.variation_images;
    }
    return item.image_url ? [item.image_url] : [];
  }, [item]);

  const sizes = useMemo(() => {
    if (!item?.sizes || typeof item.sizes !== 'string') return [];
    return item.sizes.split(',').map(s => s.trim());
  }, [item]);

  const colors = useMemo(() => {
    if (!item?.color_options) return [];
    if (Array.isArray(item.color_options)) return item.color_options;
    return [];
  }, [item]);

  const displayImage = useMemo(() => {
    if (selectedColorIndex !== null && colors[selectedColorIndex]?.image_url) {
      return colors[selectedColorIndex].image_url;
    }
    return images[activeImageIndex] || 'https://via.placeholder.com/400';
  }, [selectedColorIndex, colors, images, activeImageIndex]);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rewards')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setItem(data as RewardDetail);
    } catch (e: any) {
      console.error('[ProductDetail] Error fetching product:', e.message);
      Alert.alert('Error', 'Could not load product details.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleNextImage = () => {
    setActiveImageIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrevImage = () => {
    setActiveImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleColorSelect = (index: number) => {
    if (selectedColorIndex === index) {
      setSelectedColorIndex(null);
    } else {
      setSelectedColorIndex(index);
      setActiveImageIndex(0);
    }
  };

  const handleRedeem = async () => {
    if (!user || !item) return;

    if (sizes.length > 0 && !selectedSize) {
      toast.show({
        placement: 'top',
        render: ({ id }) => (
          <Toast nativeID={'toast-' + id} action="warning" variant="solid">
            <VStack space="xs">
              <ToastTitle>Size Required</ToastTitle>
              <ToastDescription>Please select a size before proceeding.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
      return;
    }

    if (colors.length > 0 && selectedColorIndex === null) {
      toast.show({
        placement: 'top',
        render: ({ id }) => (
          <Toast nativeID={'toast-' + id} action="warning" variant="solid">
            <VStack space="xs">
              <ToastTitle>Color Required</ToastTitle>
              <ToastDescription>Please select a color before proceeding.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
      return;
    }

    const userMinutes = liveMinutes ?? minutes?.total_minutes ?? minutes?.minutes ?? 0;
    const isVip = minutes?.vip_tier === 'premium';
    const isLegendary = item.rarity === 'legendary';
    const isRare = item.rarity === 'rare';
    const isLocked = (item.is_vip_only || isLegendary) && !isVip;

    if (isLocked) {
      Alert.alert('VIP Required', 'Legendary items are exclusive to Premium VIP members.');
      return;
    }

    if (userMinutes < item.minutes_cost) {
      Alert.alert('Insufficient Balance', `You need ${item.minutes_cost} minutes to redeem this item.`);
      return;
    }

    if (isRare || isLegendary) {
      setShowSpinModal(true);
    } else {
      setShowShippingModal(true);
    }
  };

  const finalizeRedeem = async () => {
    if (!item || !user || !profile) return;
    
    if (!shippingAddress.street || !shippingAddress.city || !shippingAddress.zip) {
      toast.show({
        placement: 'top',
        render: ({ id }) => (
          <Toast nativeID={'toast-' + id} action="warning" variant="solid">
            <ToastTitle>Incomplete Address</ToastTitle>
          </Toast>
        ),
      });
      return;
    }

    setRedeeming(true);
    try {
      // 1. Update Profile if "Save as default" is checked
      if (saveAsDefault) {
        await updateProfile({
          shipping_name: shippingAddress.name,
          shipping_address: shippingAddress.street,
          shipping_city: shippingAddress.city,
          shipping_state: shippingAddress.state,
          shipping_zip: shippingAddress.zip,
          shipping_country: shippingAddress.country,
        });
      }

      // 2. Insert redemption record with address
      const selectedColor = selectedColorIndex !== null ? colors[selectedColorIndex].name : null;
      const selectionText = [selectedSize, selectedColor].filter(Boolean).join(', ');
      
      const { error: redeemError } = await redeemReward(profile.id, {
        id: item.id,
        title: item.title + (selectionText ? ` (${selectionText})` : ''),
        minutes_cost: item.minutes_cost,
        image_url: displayImage,
        rarity: item.rarity ?? undefined,
        type: item.type ?? undefined,
        selectedColor: selectedColor,
      }, {
        name: shippingAddress.name,
        address: shippingAddress.street,
        city: shippingAddress.city,
        state: shippingAddress.state,
        zip: shippingAddress.zip,
        country: shippingAddress.country,
      });

      if (redeemError) {
        Alert.alert("Error", redeemError.message || "Failed to redeem. Try again.");
        return;
      }

      // 3. Deduct minutes using the atomic RPC
      const { error: minutesError } = await supabase.rpc("atomic_increment_minutes", {
        p_amount: -item.minutes_cost,
        p_user_id: user.id,
      });

      if (minutesError) {
        console.error("[ProductDetail] minutes deduction error:", minutesError);
      }

      // 4. Refresh profile
      await refreshProfile();

      toast.show({
        placement: 'top',
        render: ({ id }) => (
          <Toast nativeID={'toast-' + id} action="success" variant="solid">
            <VStack space="xs">
              <ToastTitle>Redemption Successful</ToastTitle>
              <ToastDescription>"{item.title}" has been added to your rewards.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
      
      setShowShippingModal(false);
    } catch (e: unknown) {
      console.error("[ProductDetail] finalizeRedeem error:", e);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#22C55E" />
      </View>
    );
  }

  if (!item) return null;

  const isVip = minutes?.vip_tier === 'premium';
  const isLegendary = item.rarity === 'legendary';
  const isLocked = (item.is_vip_only || isLegendary) && !isVip;
  const userMinutes = liveMinutes ?? minutes?.total_minutes ?? minutes?.minutes ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#FFFFFF" size={24} />
          <Text style={styles.backText}>BACK</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{item.title}</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Image Carousel */}
        <View style={styles.carouselContainer}>
          <Image 
            source={{ uri: displayImage }} 
            style={styles.mainImage}
            resizeMode="cover"
          />
          
          {images.length > 1 && (
            <>
              <TouchableOpacity style={styles.navArrowLeft} onPress={handlePrevImage}>
                <ChevronLeft color="#FFFFFF" size={32} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.navArrowRight} onPress={handleNextImage}>
                <ChevronRight color="#FFFFFF" size={32} />
              </TouchableOpacity>
            </>
          )}

          {/* Rarity Badge */}
          <View style={[
            styles.rarityBadge,
            item.rarity === 'legendary' ? styles.bgLegendary : item.rarity === 'rare' ? styles.bgRare : styles.bgCommon
          ]}>
            <Text style={styles.rarityText}>{(item.rarity || 'common').toUpperCase()}</Text>
          </View>
        </View>

        {/* Thumbnails */}
        {images.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailRow}>
            {images.map((img, idx) => (
              <TouchableOpacity 
                key={idx} 
                onPress={() => setActiveImageIndex(idx)}
                style={[styles.thumbnailWrapper,activeImageIndex === idx ? styles.thumbnailActive : undefined]}
              >
                <Image source={{ uri: img }} style={styles.thumbnailImage} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.contentPadding}>
          {/* Sizes Section */}
          {sizes.length > 0 && (
            <View style={styles.section}>
              <Heading style={styles.sectionTitle}>Sizes</Heading>
              <View style={styles.sizeRow}>
                {sizes.map((size) => (
                  <TouchableOpacity
                    key={size}
                    onPress={() => setSelectedSize(size)}
                    style={[
                      styles.sizeButton,
                      selectedSize === size ? styles.sizeButtonActive : styles.sizeButtonInactive
                    ]}
                  >
                    <Text style={[
                      styles.sizeButtonText,
                      selectedSize === size ? styles.sizeButtonTextActive : styles.sizeButtonTextInactive
                    ]}>
                      {size}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Colors Section */}
          {colors.length > 0 && (
            <View style={styles.section}>
              <Heading style={styles.sectionTitle}>Colors</Heading>
              <View style={styles.colorRow}>
                {colors.map((colorObj, index) => {
                  const colorName = colorObj.name;
                  const colorHex = colorObj.hex;
                  const isSelected = selectedColorIndex === index;
                  
                  return (
                    <TouchableOpacity
                      key={`${colorName}-${index}`}
                      onPress={() => handleColorSelect(index)}
                      style={[
                        styles.colorButton,
                        isSelected ? styles.colorButtonActive : undefined,
                        isSelected ? styles.colorButtonTextActiveBg : undefined
                      ]}
                    >
                      <View style={[styles.colorSwatch, { backgroundColor: colorHex }]}>
                        {isSelected && <CheckCircle2 size={16} color={colorHex.toLowerCase() === '#ffffff' ? '#000000' : '#FFFFFF'} />}
                      </View>
                      <Text style={[
                        styles.colorButtonText,
                        isSelected ? styles.colorButtonTextActive : styles.colorButtonTextInactive
                      ]}>
                        {colorName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Shipping Section */}
          {item.ships_to && item.ships_to.length > 0 && (
            <View style={styles.section}>
              <View style={styles.shippingHeader}>
                <Globe size={18} color="#A1A1AA" />
                <Text style={styles.shippingLabel}>Ships only to:</Text>
              </View>
              <View style={styles.countryRow}>
                {item.ships_to.map((country) => (
                  <View key={country} style={styles.countryBadge}>
                    <Text style={styles.countryText}>{country.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Description Section */}
          <View style={styles.section}>
            <Text style={styles.descriptionText}>
              {item.description || item.brief || 'No description available.'}
            </Text>
          </View>

          {/* Cost Section */}
          <View style={styles.costSection}>
            <HStack space="xs" style={{ alignItems: 'center' }}>
              <Text style={styles.costLabel}>Cost:</Text>
              <Coins size={16} color="#22C55E" />
              <Text style={styles.costValue}>{item.minutes_cost} Minutes</Text>
            </HStack>

            {item.rarity === 'legendary' && item.cashout_value > 0 && (
              <View style={styles.cashoutInfoRow}>
                <HStack space="xs" style={{ alignItems: 'center' }}>
                  <Star size={16} color="#FACC15" fill="#FACC15" />
                  <Text style={styles.cashoutLabel}>Cashout Value:</Text>
                  <Text style={styles.cashoutValue}>${item.cashout_value.toFixed(2)}</Text>
                </HStack>
                <Text style={styles.cashoutDescription}>
                  If you win this legendary item, you can choose to receive the physical reward or exchange it for instant cash in your account!
                </Text>
              </View>
            )}
          </View>

          {/* VIP Upsell Section */}
          {!isVip && item.rarity === 'legendary' && (
            <View style={styles.vipUpsellCard}>
              <LinearGradient
                colors={['#1E1E38', '#2A2A4A']}
                style={styles.vipUpsellGradient}
              >
                <VStack space="md" style={{ alignItems: 'center' }}>
                  <View style={styles.vipIconContainer}>
                    <Star size={32} color="#FACC15" fill="#FACC15" />
                  </View>
                  <VStack space="xs" style={{ alignItems: 'center' }}>
                    <Text style={styles.vipUpsellTitle}>Unlock Legendary Rewards</Text>
                    <Text style={styles.vipUpsellSubtitle}>
                      Legendary items are exclusive to Premium VIP members. Upgrade now to get access to the best rewards and cash-out options!
                    </Text>
                  </VStack>
                  <TouchableOpacity 
                    style={styles.vipUpgradeButton}
                    onPress={() => router.push('/vip')}
                  >
                    <Text style={styles.vipUpgradeButtonText}>Upgrade to VIP 🔥</Text>
                  </TouchableOpacity>
                </VStack>
              </LinearGradient>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky Bottom */}
      <View style={styles.footer}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Your Balance</Text>
          <HStack space="xs" style={{ alignItems: 'center' }}>
            <Text style={styles.balanceValue}>{userMinutes}</Text>
            <Text style={styles.balanceUnit}>Minutes</Text>
          </HStack>
        </View>

        {isLocked ? (
          <View style={styles.lockedButton}>
            <Lock size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.ctaButtonText}>LOCKED</Text>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.ctaButtonWrapper}
            onPress={handleRedeem}
            disabled={redeeming}
          >
            <LinearGradient
              colors={item.rarity === 'common' ? ['#22C55E', '#16A34A'] : ['#8B5CF6', '#3B82F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaButtonGradient}
            >
              {redeeming ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.ctaButtonText}>
                  {item.rarity === 'common' ? 'Redeem' : '🎰 Spin to Win'}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* Modals */}
      <RewardSpinModal
        isOpen={showSpinModal}
        onClose={() => setShowSpinModal(false)}
        selectedSize={selectedSize}
        selectedColor={selectedColorIndex !== null ? colors[selectedColorIndex].name : null}
        reward={{
          ...item,
          name: item.title,
          description: item.brief
        } as any}
        onWin={(redemptionId) => {
          setWonRedemptionId(redemptionId);
          if (item.rarity === 'legendary') {
            setShowCashoutModal(true);
          }
        }}
      />

      {wonRedemptionId && (
        <CashoutChoiceModal
          isOpen={showCashoutModal}
          onClose={() => setShowCashoutModal(false)}
          redemptionId={wonRedemptionId}
          reward={{
            title: item.title,
            image_url: item.image_url,
            cashout_value: item.cashout_value,
            requires_shipping: item.type === 'physical'
          }}
        />
      )}

      {/* Shipping Modal */}
      <Modal 
        isOpen={showShippingModal} 
        onClose={() => setShowShippingModal(false)}
        size="lg"
      >
        <ModalBackdrop />
        <ModalContent style={flattenStyle([styles.modalContent, { backgroundColor: '#1A1A2E' }])}>
          <ModalHeader style={styles.modalHeader}>
            <VStack space="xs">
              <Heading style={styles.modalTitle}>Shipping Details</Heading>
              <Text style={styles.modalSubtitle}>Where should we send your reward?</Text>
            </VStack>
            <ModalCloseButton onPress={() => setShowShippingModal(false)}>
              <X size={20} color="#71717A" />
            </ModalCloseButton>
          </ModalHeader>
          <ModalBody style={styles.modalBody}>
            <VStack space="lg" style={styles.formContainer}>
              {(profile?.shipping_address || profile?.shipping_name) && (
                <TouchableOpacity 
                  style={[
                    styles.addressOption,
isUsingSavedAddress ? styles.addressOptionSelected : undefined
                  ]}
                  onPress={() => setIsUsingSavedAddress(true)}
                  activeOpacity={0.7}
                >
                  <HStack space="sm" style={{ alignItems: 'center', marginBottom: 4 }}>
                    <MapPin size={16} color={isUsingSavedAddress ? "#22C55E" : "#71717A"} />
                    <Text style={[styles.addressOptionTitle,isUsingSavedAddress ? styles.addressOptionTitleSelected : undefined]}>
                      Use Saved Address
                    </Text>
                  </HStack>
                  <Text style={styles.addressOptionText}>
                    {profile.shipping_name}{"\n"}
                    {profile.shipping_address}, {profile.shipping_city}{"\n"}
                    {profile.shipping_state} {profile.shipping_zip}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={[
                  styles.addressOption,
!isUsingSavedAddress ? styles.addressOptionSelected : undefined
                ]}
                onPress={() => setIsUsingSavedAddress(false)}
                activeOpacity={0.7}
              >
                <HStack space="sm" style={{ alignItems: 'center' }}>
                  <Edit2 size={16} color={!isUsingSavedAddress ? "#22C55E" : "#71717A"} />
                  <Text style={[styles.addressOptionTitle,!isUsingSavedAddress ? styles.addressOptionTitleSelected : undefined]}>
                    Use New Address
                  </Text>
                </HStack>
              </TouchableOpacity>

              {!isUsingSavedAddress && (
                <VStack space="md" style={styles.newAddressForm}>
                  <VStack space="xs">
                    <Text style={styles.inputLabel}>Full Name</Text>
                    <Input variant="outline" size="md" style={styles.input}>
                      <InputField 
                        style={styles.inputText}
                        placeholder="John Doe" 
                        placeholderTextColor="#71717A"
                        value={shippingAddress.name}
                        onChangeText={(val) => setShippingAddress(prev => ({ ...prev, name: val }))}
                      />
                    </Input>
                  </VStack>

                  <VStack space="xs">
                    <Text style={styles.inputLabel}>Street Address</Text>
                    <Input variant="outline" size="md" style={styles.input}>
                      <InputField 
                        style={styles.inputText}
                        placeholder="123 Main St" 
                        placeholderTextColor="#71717A"
                        value={shippingAddress.street}
                        onChangeText={(val) => setShippingAddress(prev => ({ ...prev, street: val }))}
                      />
                    </Input>
                  </VStack>

                  <HStack space="md">
                    <VStack space="xs" style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>City</Text>
                      <Input variant="outline" size="md" style={styles.input}>
                        <InputField 
                          style={styles.inputText}
                          placeholder="City" 
                          placeholderTextColor="#71717A"
                          value={shippingAddress.city}
                          onChangeText={(val) => setShippingAddress(prev => ({ ...prev, city: val }))}
                        />
                      </Input>
                    </VStack>
                    <VStack space="xs" style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>State</Text>
                      <Input variant="outline" size="md" style={styles.input}>
                        <InputField 
                          style={styles.inputText}
                          placeholder="State" 
                          placeholderTextColor="#71717A"
                          value={shippingAddress.state}
                          onChangeText={(val) => setShippingAddress(prev => ({ ...prev, state: val }))}
                        />
                      </Input>
                    </VStack>
                  </HStack>

                  <HStack space="md">
                    <VStack space="xs" style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Zip Code</Text>
                      <Input variant="outline" size="md" style={styles.input}>
                        <InputField 
                          style={styles.inputText}
                          placeholder="Zip" 
                          placeholderTextColor="#71717A"
                          value={shippingAddress.zip}
                          onChangeText={(val) => setShippingAddress(prev => ({ ...prev, zip: val }))}
                        />
                      </Input>
                    </VStack>
                    <VStack space="xs" style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Country</Text>
                      <Input variant="outline" size="md" style={styles.input}>
                        <InputField 
                          style={styles.inputText}
                          placeholder="Country" 
                          placeholderTextColor="#71717A"
                          value={shippingAddress.country}
                          onChangeText={(val) => setShippingAddress(prev => ({ ...prev, country: val }))}
                        />
                      </Input>
                    </VStack>
                  </HStack>

                  <Checkbox 
                    value="save" 
                    isChecked={saveAsDefault} 
                    onChange={(val) => setSaveAsDefault(val)}
                    size="md"
                  >
                    <CheckboxIndicator>
                      <CheckboxIcon as={CheckIcon} />
                    </CheckboxIndicator>
                    <CheckboxLabel style={styles.checkboxLabel}>Save as default address</CheckboxLabel>
                  </Checkbox>
                </VStack>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter style={styles.modalFooter}>
            <Button
              style={styles.cancelBtn}
              variant="outline"
              action="secondary"
              onPress={() => setShowShippingModal(false)}
            >
              <ButtonText style={styles.cancelBtnText}>Cancel</ButtonText>
            </Button>
            <Button
              style={styles.confirmBtn}
              onPress={finalizeRedeem}
              isDisabled={redeeming}
            >
              {redeeming ? <ButtonSpinner color="#FFFFFF" /> : <ButtonText style={styles.confirmBtnText}>Confirm Redemption</ButtonText>}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A4A',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  carouselContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.9,
    position: 'relative',
    backgroundColor: '#000000',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  navArrowLeft: {
    position: 'absolute',
    left: 10,
    top: '45%',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    padding: 4,
  },
  navArrowRight: {
    position: 'absolute',
    right: 10,
    top: '45%',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    padding: 4,
  },
  rarityBadge: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  bgCommon: { backgroundColor: '#4B5563' },
  bgRare: { backgroundColor: '#3B82F6' },
  bgLegendary: { backgroundColor: '#F59E0B' },
  rarityText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  thumbnailRow: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  thumbnailWrapper: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  thumbnailActive: {
    borderColor: '#22C55E',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  contentPadding: {
    paddingHorizontal: 20,
  },
  // Modal Styles
  modalContent: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#2A2A4A',
  },
  modalHeader: {
    borderBottomWidth: 0,
    paddingTop: 24,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
  },
  modalSubtitle: {
    color: '#A1A1AA',
    fontSize: 14,
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  modalFooter: {
    padding: 24,
    borderTopWidth: 0,
    gap: 12,
  },
  formContainer: {
    width: '100%',
  },
  addressOption: {
    backgroundColor: '#1E1E38',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A4A',
  },
  addressOptionSelected: {
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34, 197, 94, 0.05)',
  },
  addressOptionTitle: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: 'bold',
  },
  addressOptionTitleSelected: {
    color: '#22C55E',
  },
  addressOptionText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
  },
  newAddressForm: {
    marginTop: 8,
  },
  inputLabel: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#111122',
    borderColor: '#2A2A4A',
    borderRadius: 10,
    height: 48,
  },
  inputText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  checkboxLabel: {
    color: '#A1A1AA',
    fontSize: 14,
  },
  cancelBtn: {
    flex: 1,
    borderColor: '#2A2A4A',
    height: 48,
    borderRadius: 10,
  },
  cancelBtnText: {
    color: '#A1A1AA',
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: '#22C55E',
    height: 48,
    borderRadius: 10,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    marginBottom: 12,
  },
  sizeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  sizeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sizeButtonActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  sizeButtonInactive: {
    backgroundColor: 'transparent',
    borderColor: '#2A2A4A',
  },
  sizeButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  sizeButtonTextActive: {
    color: '#FFFFFF',
  },
  sizeButtonTextInactive: {
    color: '#A1A1AA',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorButton: {
    minWidth: 80,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#2A2A4A',
    paddingHorizontal: 12,
    gap: 8,
  },
  colorButtonActive: {
    borderColor: '#22C55E',
  },
  colorButtonTextActiveBg: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  colorButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  colorButtonTextActive: {
    color: '#FFFFFF',
  },
  colorButtonTextInactive: {
    color: '#A1A1AA',
  },
  colorBubbleInactive: {
    backgroundColor: 'transparent',
  },
  shippingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  shippingLabel: {
    color: '#A1A1AA',
    fontSize: 14,
  },
  countryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  countryBadge: {
    backgroundColor: '#2A2A4A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  countryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  descriptionText: {
    color: '#A1A1AA',
    fontSize: 15,
    lineHeight: 22,
  },
  costSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A2A4A',
  },
  costLabel: {
    color: '#A1A1AA',
    fontSize: 16,
  },
  costValue: {
    color: '#22C55E',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cashoutInfoRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  cashoutLabel: {
    color: '#A1A1AA',
    fontSize: 16,
  },
  cashoutValue: {
    color: '#FACC15',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cashoutDescription: {
    color: '#71717A',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1A2E',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A2A4A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  balanceCard: {
    flex: 1,
    backgroundColor: '#1E1E38',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#2A2A4A',
  },
  balanceLabel: {
    color: '#71717A',
    fontSize: 12,
    marginBottom: 2,
  },
  balanceValue: {
    color: '#22C55E',
    fontSize: 18,
    fontWeight: 'bold',
  },
  balanceUnit: {
    color: '#22C55E',
    fontSize: 12,
    opacity: 0.8,
  },
  ctaButtonWrapper: {
    flex: 1.5,
    height: 56,
  },
  ctaButtonGradient: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  lockedButton: {
    flex: 1.5,
    height: 56,
    backgroundColor: '#4B5563',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vipUpsellCard: {
    marginTop: 32,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FACC15',
  },
  vipUpsellGradient: {
    padding: 24,
  },
  vipIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(250, 204, 21, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  vipUpsellTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  vipUpsellSubtitle: {
    color: '#A1A1AA',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  vipUpgradeButton: {
    backgroundColor: '#FACC15',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  vipUpgradeButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});