import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Animated,
  Dimensions,
  Easing,
  Image,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  Trophy,
  Star,
  X,
  MapPin,
  Gift,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  TrendingUp,
  DollarSign,
  Package,
  Edit2,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCETracker } from '@/hooks/useCETracker';
import { useCEProgress } from '@/hooks/useCEProgress';
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from '@/components/ui/modal';
import { Button, ButtonText, ButtonSpinner } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Heading } from '@/components/ui/heading';
import { Input, InputField } from '@/components/ui/input';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import {
  Checkbox,
  CheckboxIndicator,
  CheckboxIcon,
  CheckboxLabel,
} from '@/components/ui/checkbox';
import { CheckIcon } from '@/components/ui/icon';
import { useToast, Toast, ToastTitle, ToastDescription } from '@/components/ui/toast';
import { flattenStyle } from '@/utils/flatten-style';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLOT_WIDTH = 140;
const TOTAL_SLOTS = 28;
const WINNER_INDEX = 24;
const SPIN_DURATION = 3500;

interface RewardItem {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  minutes_cost: number;
  rarity: 'common' | 'rare' | 'legendary' | null;
  type: string | null;
  visible: boolean;
  cashout_value: number;
  is_vip_only: boolean;
  category_id?: string | null;
  stock_quantity?: number;
  target_gender?: string | null;
}

interface RewardSpinModalProps {
  isOpen: boolean;
  onClose: () => void;
  reward: RewardItem;
  onWin?: (redemptionId: string) => void;
  selectedSize?: string | null;
  selectedColor?: string | null;
}

export const RewardSpinModal: React.FC<RewardSpinModalProps> = ({
  isOpen,
  onClose,
  reward,
  onWin,
  selectedSize,
  selectedColor,
}) => {
  const { user, profile, minutes, refreshProfile, updateProfile } = useAuth();
  useCETracker();
  const { currentCE } = useCEProgress();
  const toast = useToast();
  const [step, setStep] = useState<'idle' | 'spinning' | 'result'>('idle');
  const [won, setWon] = useState(false);
  const [consolationItem, setConsolationItem] = useState<RewardItem | null>(null);
  const [commonItems, setCommonItems] = useState<RewardItem[]>([]);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [hasUsedSecondChance, setHasUsedSecondChance] = useState(false);
  const [showShippingForm, setShowShippingForm] = useState(false);
  const [isUsingSavedAddress, setIsUsingSavedAddress] = useState(true);
  const [currentRedemptionId, setCurrentRedemptionId] = useState<string | null>(null);
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [shippingAddress, setShippingAddress] = useState({
    name: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    country: '',
  });
  const [liveMinutes, setLiveMinutes] = useState<number | null>(null);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const reelItems = useMemo(() => {
    if (commonItems.length === 0) return [];
    
    const items: (RewardItem | null)[] = [];
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      if (i === WINNER_INDEX) {
        if (won) {
          items.push(reward);
        } else if (consolationItem) {
          items.push(consolationItem);
        } else {
          items.push(commonItems[Math.floor(Math.random() * commonItems.length)]);
        }
      } else {
        items.push(commonItems[Math.floor(Math.random() * commonItems.length)]);
      }
    }
    return items;
  }, [commonItems, won, reward, consolationItem]);

  useEffect(() => {
    if (isOpen) {
      fetchCommonItems();
      resetState();

      // Fetch fresh balance when modal opens
      if (user?.id) {
        supabase.functions.invoke('earn-minutes', {
          body: { type: 'get_balance', userId: user.id },
        }).then(({ data }) => {
          if (data?.totalMinutes !== undefined) setLiveMinutes(data.totalMinutes);
        }).catch(() => {});
      }
      
      // Pre-fill from profile
      if (profile) {
        // Default to saved address if any info is there
        const hasSaved = !!(profile.shipping_address || profile.shipping_city || profile.shipping_name);
        setIsUsingSavedAddress(hasSaved);

        setShippingAddress({
          name: profile.shipping_name || '',
          street: profile.shipping_address || '',
          city: profile.shipping_city || '',
          state: profile.shipping_state || '',
          zip: profile.shipping_zip || '',
          country: profile.shipping_country || '',
        });
      }
    }
  }, [isOpen, profile]);

  const fetchCommonItems = async () => {
    try {
      const { data } = await supabase
        .from('rewards')
        .select('*')
        .eq('rarity', 'common')
        .limit(10);
      if (data) {
        setCommonItems(data.map(item => ({
          ...item,
          name: item.name || item.title,
          description: item.description || item.brief
        })));
      }
    } catch (e) {
      console.error('Error fetching common items:', e);
    }
  };

  const resetState = () => {
    setStep('idle');
    setWon(false);
    setConsolationItem(null);
    setIsRedeeming(false);
    setHasUsedSecondChance(false);
    setShowShippingForm(false);
    setSaveAsDefault(false);
    spinAnim.setValue(0);
  };

  const handleSpin = async (isSecondChance = false) => {
    if (!user || !minutes) return;

    const currentBalance = liveMinutes ?? minutes?.minutes ?? 0;

    if (!isSecondChance && currentBalance < reward.minutes_cost) {
      toast.show({
        placement: 'top',
        render: ({ id }) => (
          <Toast nativeID={'toast-' + id} action="error" variant="solid">
            <VStack space="xs">
              <ToastTitle>Not Enough Minutes</ToastTitle>
              <ToastDescription>You need {reward.minutes_cost} minutes to spin for this item.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
      return;
    }

    setIsRedeeming(true);

    // Determine outcome before animation
    const baseRate = reward.rarity === 'legendary' ? 2 : 5;
    const winChance = baseRate + currentCE;
    const isWinner = Math.random() * 100 < winChance;

    // Capture consolation item in a local variable BEFORE setting state
    // so the animation callback closure always has the fresh value (not stale state)
    const pickedConsolation = !isWinner && commonItems.length > 0
      ? commonItems[Math.floor(Math.random() * commonItems.length)]
      : null;

    setWon(isWinner);
    if (!isWinner && pickedConsolation) {
      setConsolationItem(pickedConsolation);
    } else {
      setConsolationItem(null);
    }
    setStep('spinning');

    // Deduct minutes if not a second chance
    if (!isSecondChance) {
      try {
        await supabase.rpc('atomic_increment_minutes', {
          p_amount: -reward.minutes_cost,
          p_user_id: user.id,
        });
        await refreshProfile();
      } catch (e) {
        console.error('Error deducting minutes:', e);
      }
    }

    // Animation logic
    const modalWidth = SCREEN_WIDTH * 0.9;
    const containerWidth = modalWidth - 48;
    const centerPoint = containerWidth / 2;
    const randomOffset = (Math.random() - 0.5) * (SLOT_WIDTH * 0.7);
    const targetTranslateX = centerPoint - (WINNER_INDEX * SLOT_WIDTH + SLOT_WIDTH / 2 + randomOffset);

    Animated.timing(spinAnim, {
      toValue: targetTranslateX,
      duration: SPIN_DURATION,
      easing: Easing.bezier(0.12, 0, 0.39, 0),
      useNativeDriver: true,
    }).start(async () => {
      setStep('result');
      setIsRedeeming(false);

      // Use local variables (not state) to avoid stale closure — critical for respin
      const winItem = isWinner ? reward : (pickedConsolation || (commonItems.length > 0 ? commonItems[0] : null));

      if (winItem && user) {
        // Create redemption record
        try {
          const selectionText = [selectedSize, selectedColor].filter(Boolean).join(', ');
          const { data, error } = await supabase.from('member_redemptions').insert({
            user_id: user.id,
            reward_id: winItem.id,
            reward_title: winItem.name + (selectionText ? ` (${selectionText})` : ''),
            reward_rarity: winItem.rarity,
            reward_image_url: winItem.image_url,
            minutes_cost: isSecondChance ? 0 : reward.minutes_cost,
            selected_color: selectedColor ?? null,
            status: 'processing',
          }).select('id').single();

          if (data?.id) {
            setCurrentRedemptionId(data.id);
            if (isWinner && onWin) onWin(data.id);
          }
        } catch (e) {
          console.error('Error creating redemption:', e);
        }

        // For physical rewards, show shipping form.
        if (winItem.type === 'physical') {
          if (winItem.rarity !== 'legendary') {
            setShowShippingForm(true);
          }
        }
      }
    });
  };

  const handleSecondChance = () => {
    if (won) return; // Safety check
    setHasUsedSecondChance(true);
    setWon(false);
    setStep('idle');
    spinAnim.setValue(0);
    // Use a small delay to ensure animation reset is visible and state is cleared
    setTimeout(() => {
      handleSpin(true);
    }, 100);
  };

  const handleShippingSubmit = async () => {
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

    try {
      // 1. Update record in member_redemptions
      if (currentRedemptionId) {
        await supabase.from('member_redemptions').update({
          shipping_name: shippingAddress.name,
          shipping_address: shippingAddress.street,
          shipping_city: shippingAddress.city,
          shipping_state: shippingAddress.state,
          shipping_zip: shippingAddress.zip,
          shipping_country: shippingAddress.country,
        }).eq('id', currentRedemptionId);
      }

      // 2. Update Profile if "Save as default" is checked
      if (saveAsDefault && user) {
        await updateProfile({
          shipping_name: shippingAddress.name,
          shipping_address: shippingAddress.street,
          shipping_city: shippingAddress.city,
          shipping_state: shippingAddress.state,
          shipping_zip: shippingAddress.zip,
          shipping_country: shippingAddress.country,
        });
      }

      toast.show({
        placement: 'top',
        render: ({ id }) => (
          <Toast nativeID={'toast-' + id} action="success" variant="solid">
            <VStack space="xs">
              <ToastTitle>Redemption Complete!</ToastTitle>
              <ToastDescription>Your reward will be shipped to you soon.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
      onClose();
    } catch (e) {
      console.error('Error submitting shipping:', e);
    }
  };

  const isPremiumVip = minutes?.vip_tier === 'premium';
  const canHaveSecondChance = !won && reward.rarity === 'legendary' && isPremiumVip && !hasUsedSecondChance;

  const baseRate = reward.rarity === 'legendary' ? 2 : 5;
  const winChance = baseRate + currentCE;

  if (showShippingForm) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <ModalBackdrop />
        <ModalContent style={[styles.modalContent, { backgroundColor: '#1A1A2E' }]}>
          <ModalHeader style={[styles.modalHeader, { backgroundColor: '#1A1A2E' }]}>
            <Heading style={styles.whiteText}>Shipping Details</Heading>
            <ModalCloseButton onPress={onClose}>
              <X size={20} color="#71717A" />
            </ModalCloseButton>
          </ModalHeader>
          <ModalBody style={[styles.modalBody, { backgroundColor: '#1A1A2E' }]}>
            <VStack space="md" style={styles.formContainer}>
              <Text style={styles.mutedText}>Where should we send your reward?</Text>
              
              {/* Saved Address Selection */}
              {(profile?.shipping_address || profile?.shipping_name) && (
                <TouchableOpacity 
                  style={[
                    styles.addressOption,
                    isUsingSavedAddress ? styles.addressOptionSelected : null
                  ]}
                  onPress={() => setIsUsingSavedAddress(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.addressOptionHeader}>
                    <MapPin size={16} color={isUsingSavedAddress ? "#FACC15" : "#71717A"} />
                    <Text style={[styles.addressOptionTitle,isUsingSavedAddress ? styles.addressOptionTitleSelected : null]}>
                      Use Saved Address
                    </Text>
                  </View>
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
                  !isUsingSavedAddress ? styles.addressOptionSelected : null
                ]}
                onPress={() => setIsUsingSavedAddress(false)}
                activeOpacity={0.7}
              >
                <View style={styles.addressOptionHeader}>
                  <Edit2 size={16} color={!isUsingSavedAddress ? "#FACC15" : "#71717A"} />
                  <Text style={[styles.addressOptionTitle,!isUsingSavedAddress ? styles.addressOptionTitleSelected : null]}>
                    Use New Address
                  </Text>
                </View>
              </TouchableOpacity>

              {/* New Address Form */}
              {!isUsingSavedAddress && (
                <VStack space="md" style={styles.newAddressForm}>
                  <VStack space="xs">
                    <Text style={styles.inputLabel}>Full Name</Text>
                    <Input style={styles.input}>
                      <InputField 
                        style={styles.inputText}
                        placeholder="Enter your name" 
                        placeholderTextColor="#71717A"
                        value={shippingAddress.name}
                        onChangeText={(val) => setShippingAddress(prev => ({ ...prev, name: val }))}
                      />
                    </Input>
                  </VStack>

                  <VStack space="xs">
                    <Text style={styles.inputLabel}>Street Address</Text>
                    <Input style={styles.input}>
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
                    <VStack space="xs" style={styles.flex1}>
                      <Text style={styles.inputLabel}>City</Text>
                      <Input style={styles.input}>
                        <InputField 
                          style={styles.inputText}
                          placeholder="City" 
                          placeholderTextColor="#71717A"
                          value={shippingAddress.city}
                          onChangeText={(val) => setShippingAddress(prev => ({ ...prev, city: val }))}
                        />
                      </Input>
                    </VStack>
                    <VStack space="xs" style={styles.zipInput}>
                      <Text style={styles.inputLabel}>Zip</Text>
                      <Input style={styles.input}>
                        <InputField 
                          style={styles.inputText}
                          placeholder="12345" 
                          placeholderTextColor="#71717A"
                          value={shippingAddress.zip}
                          onChangeText={(val) => setShippingAddress(prev => ({ ...prev, zip: val }))}
                        />
                      </Input>
                    </VStack>
                  </HStack>

                  <Checkbox
                    size="md"
                    value="saveDefault"
                    isChecked={saveAsDefault}
                    onChange={(checked) => setSaveAsDefault(checked)}
                  >
                    <CheckboxIndicator>
                      <CheckboxIcon as={CheckIcon} />
                    </CheckboxIndicator>
                    <CheckboxLabel style={styles.checkboxLabel}>Save as my default shipping address</CheckboxLabel>
                  </Checkbox>
                </VStack>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter style={styles.modalFooter}>
            <Button 
              style={styles.primaryButton}
              onPress={handleShippingSubmit}
            >
              <ButtonText style={styles.primaryButtonText}>Confirm & Redeem</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalBackdrop />
      <ModalContent style={[styles.modalContentNoPadding, { backgroundColor: '#1A1A2E' }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: '#1A1A2E' }]}>
          <HStack style={styles.headerRow}>
            <VStack>
              <Text style={styles.headerLabel}>Spin For Chance</Text>
              <Text style={styles.headerTitle}>{(reward.rarity || 'common').toUpperCase()}</Text>
            </VStack>
            
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#71717A" />
            </TouchableOpacity>
          </HStack>
        </View>

        <ModalBody style={[styles.modalBodyNoPadding, { backgroundColor: '#1A1A2E' }]}>
          <View style={styles.spinnerContainer}>
            {/* Reel Pointer */}
            <View style={styles.pointer} />
            
            {/* Reel */}
            <View style={styles.reelWrapper}>
              {commonItems.length === 0 ? (
                <View style={styles.centered}>
                  <ActivityIndicator color="#EF4444" />
                </View>
              ) : (
                <Animated.View
                  style={flattenStyle([
                    styles.reel,
                    { transform: [{ translateX: spinAnim }] }
                  ])}
                >
                  {reelItems.map((item, idx) => (
                    <View key={`${idx}-${item?.id}`} style={styles.slot}>
                      <View style={flattenStyle([
                        styles.slotCard,
                        item?.rarity === 'legendary' ? styles.slotCardLegendary : 
                        item?.rarity === 'rare' ? styles.slotCardRare : 
                        styles.slotCardCommon
                      ])}>
                        {item?.image_url ? (
                          <Image source={{ uri: item.image_url }} style={styles.slotImage} />
                        ) : (
                          <View style={styles.slotImagePlaceholder}>
                            <Gift size={24} color="#3F3F46" />
                          </View>
                        )}
                        <Text style={styles.slotTitle} numberOfLines={1}>{item?.name}</Text>
                      </View>
                    </View>
                  ))}
                </Animated.View>
              )}
            </View>
          </View>

          {/* Controls / Info */}
          <VStack style={styles.controls} space="lg">
            {step === 'idle' && (
              <VStack space="md">
                <View style={styles.infoCard}>
                  <HStack style={styles.infoCardRow}>
                    <VStack>
                      <Text style={styles.infoLabel}>Cost to Spin</Text>
                      <Text style={styles.infoValue}>{reward.minutes_cost} MINS</Text>
                    </VStack>
                    <View style={styles.oddsBadge}>
                      <Star size={12} color="#FACC15" fill="#FACC15" style={{ marginRight: 4 }} />
                      <Text style={styles.oddsText}>
                        {winChance}% Win Chance{currentCE > 0 ? ` (+${currentCE}% CE)` : ''}
                      </Text>
                    </View>
                  </HStack>
                </View>

                <Button 
                  style={styles.spinButton}
                  onPress={() => handleSpin()}
                  disabled={isRedeeming}
                >
                  {isRedeeming ? (
                    <ButtonSpinner color="#FFFFFF" />
                  ) : (
                    <ButtonText style={styles.spinButtonText}>SPIN NOW</ButtonText>
                  )}
                </Button>
                
                <Text style={styles.footerText}>
                  Minutes will be deducted upon spinning. Good luck!
                </Text>
              </VStack>
            )}

            {step === 'spinning' && (
              <VStack style={styles.spinningContainer} space="md">
                <ActivityIndicator size="large" color="#EF4444" />
                <Text style={styles.spinningText}>Good luck!</Text>
              </VStack>
            )}

            {step === 'result' && (
              <VStack space="lg">
                {won ? (
                  <VStack style={styles.resultContainer} space="sm">
                    <View style={styles.winIconWrapper}>
                      <Trophy size={48} color="#22C55E" />
                    </View>
                    <Heading style={styles.whiteTextXl}>CONGRATULATIONS!</Heading>
                    <Text style={styles.mutedTextCenter}>You won the {reward.name}!</Text>
                    <Button 
                      style={styles.continueButton}
                      onPress={() => {
                        if (reward.rarity === 'legendary') {
                          // Parent handles legendary win via onWin which unmounts this
                          onClose();
                        } else if (reward.type === 'physical') {
                          setShowShippingForm(true);
                        } else {
                          onClose();
                        }
                      }}
                    >
                      <ButtonText style={styles.continueButtonText}>CONTINUE</ButtonText>
                    </Button>
                  </VStack>
                ) : (
                  <VStack style={styles.resultContainer} space="sm">
                    <View style={styles.winIconWrapper}>
                      <Trophy size={48} color="#22C55E" />
                    </View>
                    <Heading style={styles.whiteTextLg}>CONSOLATION PRIZE!</Heading>
                    <VStack space="xs" style={styles.centerItems}>
                      <Text style={styles.mutedTextCenter}>
                        You didn't get the {reward.name}, but you won:
                      </Text>
                      <Text style={styles.consolationName}>
                        {consolationItem?.name || 'Common Item'}
                      </Text>
                    </VStack>
                    
                    {canHaveSecondChance ? (
                      <VStack style={styles.perkCard} space="md">
                        <HStack space="sm" style={styles.centerItems}>
                          <Star size={18} color="#FACC15" fill="#FACC15" />
                          <Text style={styles.perkLabel}>PREMIUM VIP PERK</Text>
                        </HStack>
                        <Text style={styles.perkDescription}>
                          As a Premium member, you get <Text style={styles.perkHighlight}>1 FREE RE-SPIN</Text> on Legendary items!
                        </Text>
                        <Button 
                          style={styles.perkButton}
                          onPress={handleSecondChance}
                        >
                          <ButtonText style={styles.perkButtonText}>USE FREE RE-SPIN</ButtonText>
                        </Button>
                        <TouchableOpacity onPress={onClose} style={{ alignSelf: 'center', marginTop: 8 }}>
                          <Text style={styles.mutedTextSmall}>No thanks, I'll keep the consolation prize</Text>
                        </TouchableOpacity>
                      </VStack>
                    ) : (
                      <Button 
                        style={styles.continueButton}
                        onPress={() => {
                          if (consolationItem?.type === 'physical') {
                            setShowShippingForm(true);
                          } else {
                            onClose();
                          }
                        }}
                      >
                        <ButtonText style={styles.continueButtonText}>CONTINUE</ButtonText>
                      </Button>
                    )}
                  </VStack>
                )}
              </VStack>
            )}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContent: {
    backgroundColor: '#1A1A2E',
    borderRadius: 24,
    maxHeight: '90%',
    padding: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  modalContentNoPadding: {
    backgroundColor: '#1A1A2E',
    borderColor: '#27272A',
    padding: 0,
    overflow: 'hidden',
    borderRadius: 24,
  },
  modalHeader: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalBody: {
    marginTop: 0,
    marginBottom: 0,
  },
  modalBodyNoPadding: {
    marginTop: 0,
    marginBottom: 0,
  },
  modalFooter: {
    marginTop: 24,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  headerRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLabel: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
  },
  ceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(250, 204, 21, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.2)',
  },
  ceText: {
    color: '#FACC15',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#1A1A2E',
  },
  spinnerContainer: {
    height: 180,
    backgroundColor: '#11111e',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  pointer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 4,
    backgroundColor: '#EF4444',
    zIndex: 10,
    transform: [{ translateX: -2 }],
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  reelWrapper: {
    height: 140,
    width: '100%',
  },
  reel: {
    flexDirection: 'row',
    height: '100%',
  },
  slot: {
    width: SLOT_WIDTH,
    height: '100%',
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotCard: {
    width: '100%',
    height: '100%',
    backgroundColor: '#16213E',
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotCardCommon: {
    borderColor: '#3F3F46',
  },
  slotCardRare: {
    borderColor: '#8B5CF6',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  slotCardLegendary: {
    borderColor: '#FACC15',
    backgroundColor: 'rgba(250, 204, 21, 0.1)',
  },
  slotImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginBottom: 8,
  },
  slotImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  slotTitle: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  controls: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  infoCard: {
    backgroundColor: '#16213E',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  infoCardRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  infoLabel: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  infoValue: {
    color: '#FACC15',
    fontWeight: '900',
    fontSize: 20,
  },
  oddsBadge: {
    backgroundColor: 'rgba(250, 204, 21, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.2)',
  },
  oddsText: {
    color: '#FACC15',
    fontWeight: '700',
    fontSize: 12,
  },
  spinButton: {
    backgroundColor: '#EF4444',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  spinButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  footerText: {
    color: '#71717A',
    textAlign: 'center',
    fontSize: 12,
  },
  spinningContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  spinningText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  resultContainer: {
    alignItems: 'center',
  },
  winIconWrapper: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    padding: 16,
    borderRadius: 100,
    marginBottom: 8,
  },
  loseIconWrapper: {
    backgroundColor: '#27272a',
    padding: 16,
    borderRadius: 100,
    marginBottom: 8,
  },
  whiteText: {
    color: '#FFFFFF',
  },
  whiteTextBold: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  whiteTextLg: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  whiteTextXl: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  mutedTextCenter: {
    color: '#A1A1AA',
    textAlign: 'center',
    fontSize: 14,
  },
  mutedText: {
    color: '#A1A1AA',
    fontSize: 14,
  },
  mutedTextSmall: {
    color: '#71717A',
    fontSize: 12,
  },
  continueButton: {
    width: '100%',
    backgroundColor: '#22C55E',
    height: 48,
    borderRadius: 12,
    marginTop: 16,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  perkCard: {
    width: '100%',
    marginTop: 16,
    backgroundColor: 'rgba(250, 204, 21, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.2)',
    borderRadius: 20,
    padding: 16,
  },
  perkLabel: {
    color: '#FACC15',
    fontWeight: '900',
    fontStyle: 'italic',
  },
  perkDescription: {
    color: '#D4D4D8',
    fontSize: 14,
  },
  perkHighlight: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  perkButton: {
    backgroundColor: '#FACC15',
    height: 48,
    borderRadius: 12,
  },
  perkButtonText: {
    color: '#000000',
    fontWeight: '900',
  },
  closeOutlineButton: {
    width: '100%',
    borderColor: '#27272A',
    height: 48,
    borderRadius: 12,
    marginTop: 16,
  },
  cashoutContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  cashoutIconWrapper: {
    backgroundColor: 'rgba(250, 204, 21, 0.2)',
    padding: 16,
    borderRadius: 100,
  },
  centerItems: {
    alignItems: 'center',
  },
  itemPreview: {
    width: '100%',
    backgroundColor: '#16213E',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
    rowGap: 16, columnGap: 16,
    marginVertical: 12,
  },
  previewImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginBottom: 16,
  },
  itemTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  fullWidth: {
    width: '100%',
  },
  choiceButton: {
    width: '100%',
    backgroundColor: '#16213E',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
    rowGap: 16, columnGap: 16,
  },
  choiceContent: {
    flex: 1,
    marginLeft: 12,
  },
  goldTextBold: {
    color: '#FACC15',
    fontWeight: '700',
  },
  consolationName: {
    color: '#22C55E',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 4,
  },
  formContainer: {
    paddingVertical: 8,
  },
  inputLabel: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#16213E',
    borderColor: '#27272A',
    height: 48,
    borderRadius: 12,
  },
  inputText: {
    color: '#FFFFFF',
  },
  checkboxLabel: {
    color: '#A1A1AA',
    fontSize: 14,
    marginLeft: 8,
  },
  flex1: {
    flex: 1,
  },
  zipInput: {
    width: 100,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#EF4444',
    borderRadius: 12,
    height: 48,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  addressOption: {
    backgroundColor: '#16213E',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 16,
    padding: 16,
    rowGap: 8, columnGap: 8,
  },
  addressOptionSelected: {
    borderColor: '#FACC15',
    backgroundColor: 'rgba(250, 204, 21, 0.05)',
  },
  addressOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    rowGap: 8, columnGap: 8,
  },
  addressOptionTitle: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '700',
  },
  addressOptionTitleSelected: {
    color: '#FFFFFF',
  },
  addressOptionText: {
    color: '#71717A',
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 24,
  },
  newAddressForm: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
    paddingTop: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});