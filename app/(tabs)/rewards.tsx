import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { redeemReward } from "@/lib/chat-utils";
import { Star, Lock, X, MapPin, Edit2, ChevronRight } from "lucide-react-native";
import { useToast, Toast, ToastTitle, ToastDescription } from "@/components/ui/toast";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from "@/components/ui/modal";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Input, InputField } from "@/components/ui/input";
import {
  Checkbox,
  CheckboxIndicator,
  CheckboxIcon,
  CheckboxLabel,
} from "@/components/ui/checkbox";
import { CheckIcon } from "@/components/ui/icon";
import { RewardSpinModal } from "@/components/modals/RewardSpinModal";
import { CashoutChoiceModal } from "@/components/modals/CashoutChoiceModal";

const CATEGORY_COLORS: Record<string, string> = {
  Fashion: "#EC4899",
  "Gift Cards": "#F59E0B",
  Tech: "#3B82F6",
  default: "#6B7280",
};

interface Category {
  id: string;
  name: string;
}

interface RewardItem {
  id: string;
  title: string;
  brief: string | null;
  image_url: string | null;
  minutes_cost: number;
  rarity: "common" | "rare" | "legendary" | null;
  type: string | null;
  visible: boolean;
  cashout_value: number;
  is_vip_only: boolean;
  reward_categories: { name: string } | null;
}

export default function RewardsScreen() {
  const { user, profile, minutes, refreshProfile, updateProfile } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Spin Modal State
  const [selectedReward, setSelectedReward] = useState<RewardItem | null>(null);
  const [showSpinModal, setShowSpinModal] = useState(false);

  // Cashout Modal State
  const [wonRedemptionId, setWonRedemptionId] = useState<string | null>(null);
  const [wonReward, setWonReward] = useState<any>(null);
  const [showCashoutModal, setShowCashoutModal] = useState(false);

  // Shipping Modal State
  const [showShippingModal, setShowShippingModal] = useState(false);
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
  const [liveMinutes, setLiveMinutes] = useState<number | null>(null);

  const userMinutes = liveMinutes ?? minutes?.minutes ?? 0;

  // Refresh balance every time this screen is focused
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
    fetchData();
  }, []);

  useEffect(() => {
    if (showShippingModal && profile) {
      const hasSaved = !!(profile.shipping_address && profile.shipping_city);
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
  }, [showShippingModal, profile]);

  const fetchData = async () => {
    setLoading(true);
    console.log("[Rewards] Fetching rewards and categories...");
    try {
      const [{ data: cats, error: catError }, { data: rwds, error: rwdError }] = await Promise.all([
        supabase
          .from("reward_categories")
          .select("id, name")
          .order("name"),
        supabase
          .from("rewards")
          .select("*, reward_categories(name)")
          .order("minutes_cost", { ascending: true }),
      ]);
      
      if (catError) console.warn("[Rewards] Category fetch error:", catError.message);
      if (rwdError) console.warn("[Rewards] Rewards fetch error:", rwdError.message);
      
      console.log("[Rewards] Fetch result:", { 
        catsFound: cats?.length ?? 0, 
        rewardsFound: rwds?.length ?? 0 
      });

      if (cats) setCategories(cats);
      if (rwds) setRewards(rwds as RewardItem[]);
    } catch (e: any) {
      console.error("[Rewards] Error fetching rewards:", e?.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemClick = (item: RewardItem) => {
    if (!user) {
      Alert.alert("Sign In Required", "Please sign in to redeem rewards.");
      return;
    }

    const isLegendary = item.rarity === "legendary";
    const isRare = item.rarity === "rare";
    const isVip = minutes?.vip_tier === "premium";

    if (isLegendary && !isVip) {
      toast.show({
        placement: "top",
        render: ({ id }) => {
          const toastId = "toast-" + id;
          return (
            <Toast nativeID={toastId} action="warning" variant="solid">
              <VStack space="xs">
                <ToastTitle>Premium Required</ToastTitle>
                <ToastDescription>
                  Legendary items are exclusive to Premium VIP members. Upgrade to unlock!
                </ToastDescription>
              </VStack>
            </Toast>
          );
        },
      });
      return;
    }

    if (userMinutes < item.minutes_cost) {
      Alert.alert(
        "Not Enough Minutes",
        `You need ${item.minutes_cost} minutes but only have ${userMinutes}.`,
      );
      return;
    }

    setSelectedReward(item);
    
    if (isRare || isLegendary) {
      setShowSpinModal(true);
    } else {
      setShowShippingModal(true);
    }
  };

  const finalizeRedeem = async () => {
    if (!selectedReward || !user || !profile) return;
    
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

    setIsSubmitting(true);
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
      const { error: redeemError } = await redeemReward(profile.id, {
        id: selectedReward.id,
        title: selectedReward.title,
        minutes_cost: selectedReward.minutes_cost,
        image_url: selectedReward.image_url,
        rarity: selectedReward.rarity ?? undefined,
        type: selectedReward.type ?? undefined,
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
        p_amount: -selectedReward.minutes_cost,
        p_user_id: user.id,
      });

      if (minutesError) {
        console.error("[rewards] minutes deduction error:", minutesError);
      }

      // 4. Refresh profile
      await refreshProfile();

      toast.show({
        placement: 'top',
        render: ({ id }) => (
          <Toast nativeID={'toast-' + id} action="success" variant="solid">
            <VStack space="xs">
              <ToastTitle>Redemption Successful</ToastTitle>
              <ToastDescription>"${selectedReward.title}" has been added to your rewards.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
      
      setShowShippingModal(false);
      setSelectedReward(null);
    } catch (e: unknown) {
      console.error("[rewards] finalizeRedeem error:", e);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered =
    activeCategory === "All"
      ? rewards
      : rewards.filter((r) => r.reward_categories?.name === activeCategory);

  const renderItem = ({ item }: { item: RewardItem }) => {
    const isVip = minutes?.vip_tier === "premium";
    const isLegendary = item.rarity === "legendary";
    const isRare = item.rarity === "rare";
    const isLocked = isLegendary && !isVip;

    const canRedeem = !!user && userMinutes >= item.minutes_cost && !isLocked;
    const catName = item.reward_categories?.name ?? "default";
    const placeholderColor =
      CATEGORY_COLORS[catName] ?? CATEGORY_COLORS.default;
    const isRedeeming = redeeming === item.id;

    return (
      <TouchableOpacity 
        style={[styles.card,isLocked ? styles.cardLocked : null]}
        onPress={() => router.push(`/store/${item.id}`)}
        activeOpacity={0.9}
      >
        <View style={styles.imageContainer}>
          {item.image_url ? (
            <Image
              source={{ uri: item.image_url }}
              style={[styles.cardImage,isLocked ? styles.imageBlurred : null]}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.cardImage,
                {
                  backgroundColor: placeholderColor,
                  alignItems: "center",
                  justifyContent: "flex-end",
                  paddingBottom: 8,
                },
isLocked ? styles.imageBlurred : null,
              ]}
            >
              <Text style={styles.categoryLabel}>{catName}</Text>
            </View>
          )}

          {isLocked && (
            <View style={styles.lockOverlay}>
              <Lock size={32} color="#FFFFFF" />
            </View>
          )}

          {/* Rarity Badge */}
          <View
            style={[
              styles.rarityBadgeContainer,
              item.rarity === "legendary"
                ? styles.rarityLegendary
                : item.rarity === "rare"
                ? styles.rarityRare
                : styles.rarityCommon,
            ]}
          >
            {item.rarity === "legendary" && (
              <Star size={10} color="#000000" fill="#000000" style={{ marginRight: 4 }} />
            )}
            <Text
              style={[
                styles.rarityBadgeText,
item.rarity === "legendary" ? styles.rarityTextLegendary : null,
              ]}
            >
              {(item.rarity ?? "common").toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={2}>
            {item.title}
          </Text>

          <View style={styles.metaRow}>
            <Text style={styles.cardMins}>{item.minutes_cost} mins</Text>
            {isLegendary && item.cashout_value > 0 && (
              <Text style={styles.cashoutText}>
                Cash out ${item.cashout_value.toFixed(2)}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.redeemButton,
isRare ? styles.spinButtonRare : null,
isLegendary ? styles.spinButtonLegendary : null,
              (!canRedeem || isRedeeming) ? styles.redeemButtonDisabled : null,
isLocked ? styles.lockedButton : null,
            ]}
            disabled={isRedeeming}
            onPress={() => handleRedeemClick(item)}
            activeOpacity={0.8}
          >
            {isRedeeming ? (
              <ActivityIndicator
                size="small"
                color={isLegendary && !isLocked ? "#000000" : "#FFFFFF"}
              />
            ) : (
              <Text
                style={[
                  styles.redeemText,
                  (!canRedeem && !isLocked) ? styles.redeemTextDisabled : null,
                  isLegendary &&!isLocked ? styles.redeemTextLegendary : null,
                ]}
              >
                {!user
                  ? "Sign In"
                  : isLocked
                  ? "LOCKED"
                  : (isRare || isLegendary)
                  ? "SPIN"
                  : canRedeem
                  ? "Redeem"
                  : "Not enough mins"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
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

    if (saveAsDefault && user) {
      try {
        await updateProfile({
          shipping_name: shippingAddress.name,
          shipping_address: shippingAddress.street,
          shipping_city: shippingAddress.city,
          shipping_state: shippingAddress.state,
          shipping_zip: shippingAddress.zip,
          shipping_country: shippingAddress.country,
        });
      } catch (e) {
        console.error('Error saving default address:', e);
      }
    }

    toast.show({
      placement: 'top',
      render: ({ id }) => (
        <Toast nativeID={'toast-' + id} action="success" variant="solid">
          <VStack space="xs">
            <ToastTitle>Redemption Successful</ToastTitle>
            <ToastDescription>Your reward will be shipped to you soon!</ToastDescription>
          </VStack>
        </Toast>
      ),
    });
    setShowShippingModal(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Sticky Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reward Store</Text>
        <Text style={styles.headerSubtitle}>
          You have{" "}
          <Text style={styles.minutesHighlight}>{userMinutes} minutes</Text>
        </Text>
      </View>

      {/* Sticky Category Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillsContainer}
        style={styles.pillsScroll}
      >
        {["All", ...categories.map((c) => c.name)].map((cat) => (
          <TouchableOpacity
            key={cat}
            onPress={() => setActiveCategory(cat)}
            style={[styles.pill, activeCategory === cat ? styles.pillActive : styles.pillInactive]}
            activeOpacity={0.8}
          >
            <Text style={[styles.pillText, activeCategory === cat ? styles.pillTextActive : styles.pillTextInactive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#EF4444" />
          <Text style={styles.loadingText}>Loading rewards...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No rewards in this category</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.columnWrapper}
          style={styles.flatList}
        />
      )}

      {/* Reward Spin Modal */}
      {selectedReward && (
        <RewardSpinModal
          isOpen={showSpinModal}
          onClose={() => setShowSpinModal(false)}
          reward={{
            id: selectedReward.id,
            name: selectedReward.title,
            description: selectedReward.brief,
            image_url: selectedReward.image_url,
            minutes_cost: selectedReward.minutes_cost,
            rarity: selectedReward.rarity || 'common',
            cashout_value: selectedReward.cashout_value,
            category_id: null,
            stock_quantity: 1,
            is_vip_only: selectedReward.is_vip_only,
            target_gender: null,
            type: selectedReward.type,
            visible: selectedReward.visible,
          }}
          onWin={(redemptionId) => {
            if (selectedReward.rarity === 'legendary') {
              setWonRedemptionId(redemptionId);
              setWonReward({
                title: selectedReward.title,
                image_url: selectedReward.image_url,
                cashout_value: selectedReward.cashout_value,
                requires_shipping: selectedReward.type === 'physical'
              });
              // Close spin modal first, then open cashout modal
              setShowSpinModal(false);
              setShowCashoutModal(true);
            } else if (selectedReward.type === 'physical') {
              // Address form is now handled inside RewardSpinModal for wins
            }
          }}
        />
      )}

      {/* Cashout Modal */}
      {wonRedemptionId && wonReward && (
        <CashoutChoiceModal
          isOpen={showCashoutModal}
          onClose={() => {
            setShowCashoutModal(false);
            setWonRedemptionId(null);
            setWonReward(null);
            setSelectedReward(null);
          }}
          redemptionId={wonRedemptionId}
          reward={wonReward}
        />
      )}

      {/* Shipping Modal (for Common rewards) */}
      <Modal isOpen={showShippingModal} onClose={() => setShowShippingModal(false)} size="md">
        <ModalBackdrop />
        <ModalContent style={styles.modalContent}>
          <ModalHeader style={styles.modalHeader}>
            <Heading style={styles.whiteText}>Shipping Details</Heading>
            <ModalCloseButton onPress={() => setShowShippingModal(false)}>
              <X size={20} color="#71717A" />
            </ModalCloseButton>
          </ModalHeader>
          <ModalBody>
            <VStack space="md" style={styles.formContainer}>
              <Text style={styles.mutedText}>Where should we send your reward?</Text>
              
              {/* Saved Address Selection */}
              {profile?.shipping_address && (
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
                    <VStack space="xs" style={{ flex: 1 }}>
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
                    <VStack space="xs" style={{ width: 100 }}>
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
              onPress={finalizeRedeem}
              isDisabled={isSubmitting}
            >
              {isSubmitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <ButtonText style={styles.primaryButtonText}>Confirm & Redeem</ButtonText>}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#1A1A2E" },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, backgroundColor: "#1A1A2E" },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  headerSubtitle: { fontSize: 15, color: "#A1A1AA", fontWeight: "500" },
  minutesHighlight: { color: "#FACC15", fontWeight: "700" },
  pillsScroll: { flexGrow: 0, paddingBottom: 12, backgroundColor: "#1A1A2E", borderBottomWidth: 1, borderBottomColor: "#1E1E38" },
  pillsContainer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 2, gap: 8 },
  pill: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 100 },
  pillActive: { backgroundColor: "#EF4444" },
  pillInactive: { backgroundColor: "#2A2A4A", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  pillText: { fontSize: 14, fontWeight: "700" },
  pillTextActive: { color: "#FFFFFF" },
  pillTextInactive: { color: "#D1D1D1" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    rowGap: 12, columnGap: 12,
  },
  loadingText: { color: "#A1A1AA", fontSize: 14 },
  emptyText: { color: "#71717A", fontSize: 15 },
  grid: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 24 },
  columnWrapper: { justifyContent: "space-between" },
  flatList: { flex: 1 },
  card: {
    backgroundColor: "#1E1E38",
    borderRadius: 24,
    marginBottom: 12,
    overflow: "hidden",
    width: "48.5%",
    borderWidth: 1,
    borderColor: "#2A2A4A",
  },
  cardLocked: {
    opacity: 0.8,
  },
  imageContainer: {
    position: "relative",
    width: "100%",
    height: 120,
  },
  cardImage: { width: "100%", height: "100%" },
  imageBlurred: {
    opacity: 0.3,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  rarityBadgeContainer: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rarityCommon: {
    backgroundColor: "#71717A",
  },
  rarityRare: {
    backgroundColor: "#8B5CF6",
  },
  rarityLegendary: {
    backgroundColor: "#FACC15",
  },
  rarityBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  rarityTextLegendary: {
    color: "#000000",
  },
  categoryLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.8)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  cardBody: { padding: 12 },
  cardName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
    minHeight: 36,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    flexWrap: "wrap",
  },
  cardMins: { fontSize: 12, color: "#FACC15", fontWeight: "700" },
  cashoutText: {
    fontSize: 10,
    color: "#22C55E",
    fontWeight: "700",
  },
  redeemButton: {
    backgroundColor: "#EF4444",
    borderRadius: 100,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 4,
  },
  spinButtonRare: {
    backgroundColor: "#8B5CF6",
  },
  spinButtonLegendary: {
    backgroundColor: "#FACC15",
  },
  lockedButton: {
    backgroundColor: "#3F3F46",
  },
  redeemButtonDisabled: { backgroundColor: "#3F3F46" },
  redeemText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  redeemTextLegendary: { color: "#000000" },
  redeemTextDisabled: { color: "#71717A" },
  modalContent: {
    backgroundColor: "#1E1E38",
    borderColor: "#2A2A4A",
    padding: 24,
    borderRadius: 24,
  },
  modalHeader: {
    justifyContent: "space-between",
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 16,
  },
  modalFooter: {
    marginTop: 24,
  },
  whiteText: {
    color: "#FFFFFF",
  },
  mutedText: {
    color: "#A1A1AA",
    fontSize: 14,
  },
  formContainer: {
    paddingVertical: 8,
  },
  inputLabel: {
    color: "#71717A",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    marginLeft: 4,
  },
  input: {
    backgroundColor: "#1A1A2E",
    borderColor: "#2A2A4A",
    height: 48,
    borderRadius: 12,
  },
  inputText: {
    color: "#FFFFFF",
  },
  primaryButton: {
    width: "100%",
    backgroundColor: "#EF4444",
    borderRadius: 12,
    height: 48,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  checkboxLabel: {
    color: "#A1A1AA",
    fontSize: 14,
    marginLeft: 8,
  },
  addressOption: {
    backgroundColor: "#1A1A2E",
    borderWidth: 1,
    borderColor: "#2A2A4A",
    borderRadius: 16,
    padding: 16,
    rowGap: 8, columnGap: 8,
  },
  addressOptionSelected: {
    borderColor: "#FACC15",
    backgroundColor: "rgba(250, 204, 21, 0.05)",
  },
  addressOptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    rowGap: 8, columnGap: 8,
  },
  addressOptionTitle: {
    color: "#A1A1AA",
    fontSize: 14,
    fontWeight: "700",
  },
  addressOptionTitleSelected: {
    color: "#FFFFFF",
  },
  addressOptionText: {
    color: "#71717A",
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 24,
  },
  newAddressForm: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#2A2A4A",
    paddingTop: 16,
  },
});