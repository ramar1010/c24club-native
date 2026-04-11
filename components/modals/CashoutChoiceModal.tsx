import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
} from 'react-native';
import {
  DollarSign,
  Package,
  ChevronRight,
  X,
  Mail,
  User,
  MapPin,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalCloseButton,
  ModalBody,
} from '@/components/ui/modal';
import { Button, ButtonText, ButtonSpinner } from '@/components/ui/button';
import { useToast, Toast, ToastTitle, ToastDescription } from '@/components/ui/toast';
import { flattenStyle } from '@/utils/flatten-style';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CashoutChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  redemptionId: string;
  reward: {
    title: string;
    image_url: string | null;
    cashout_value: number;
    requires_shipping: boolean;
  };
}

export const CashoutChoiceModal: React.FC<CashoutChoiceModalProps> = ({
  isOpen,
  onClose,
  redemptionId,
  reward,
}) => {
  const toast = useToast();
  const [step, setStep] = useState<'choice' | 'keep_form' | 'cashout_form' | 'success'>('choice');
  const [loading, setLoading] = useState(false);
  
  // Shipping form state
  const [shippingName, setShippingName] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  
  // Cashout form state
  const [paypalEmail, setPaypalEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  const validateEmail = (email: string) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  const handleKeepItem = async () => {
    if (reward.requires_shipping) {
      setStep('keep_form');
    } else {
      await finalizeKeepItem();
    }
  };

  const finalizeKeepItem = async () => {
    if (reward.requires_shipping && (!shippingName.trim() || !shippingAddress.trim())) {
      toast.show({
        placement: 'top',
        render: ({ id }) => (
          <Toast nativeID={'toast-' + id} action="error" variant="solid">
            <ToastTitle>Required Fields</ToastTitle>
            <ToastDescription>Please enter your shipping name and address.</ToastDescription>
          </Toast>
        ),
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('member_redemptions')
        .update({
          shipping_name: shippingName || null,
          shipping_address: shippingAddress || null,
          status: 'processing',
        })
        .eq('id', redemptionId);

      if (error) throw error;

      setStep('success');
    } catch (e: any) {
      console.error('Error updating redemption:', e);
      toast.show({
        placement: 'top',
        render: ({ id }) => (
          <Toast nativeID={'toast-' + id} action="error" variant="solid">
            <ToastTitle>Error</ToastTitle>
            <ToastDescription>{e.message || 'Failed to update redemption.'}</ToastDescription>
          </Toast>
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCashoutChoice = () => {
    setStep('cashout_form');
  };

  const finalizeCashout = async () => {
    if (!validateEmail(paypalEmail)) {
      setEmailError('Please enter a valid PayPal email address.');
      return;
    }
    setEmailError('');

    setLoading(true);
    try {
      const { error } = await supabase
        .from('member_redemptions')
        .update({
          cashout_paypal: paypalEmail,
          cashout_amount: reward.cashout_value,
          cashout_status: 'pending',
        })
        .eq('id', redemptionId);

      if (error) throw error;

      setStep('success');
    } catch (e: any) {
      console.error('Error updating redemption:', e);
      toast.show({
        placement: 'top',
        render: ({ id }) => (
          <Toast nativeID={'toast-' + id} action="error" variant="solid">
            <ToastTitle>Error</ToastTitle>
            <ToastDescription>{e.message || 'Failed to process cash out.'}</ToastDescription>
          </Toast>
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (step === 'success') {
      onClose();
      // Reset state for next time
      setStep('choice');
      setShippingName('');
      setShippingAddress('');
      setPaypalEmail('');
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  const renderContent = () => {
    switch (step) {
      case 'choice':
        return (
          <View style={styles.content}>
            <View style={styles.iconCircle}>
              <DollarSign size={40} color="#FACC15" />
            </View>
            <Text style={styles.goldTitleText}>Legendary Win!</Text>
            <Text style={styles.subtitle}>You've won a premium item. Would you like to keep it or cash out?</Text>

            <View style={styles.previewCard}>
              <Image
                source={{ uri: reward.image_url || 'https://via.placeholder.com/150' }}
                style={styles.previewImage}
              />
              <View>
                <Text style={styles.previewTitle}>{reward.title}</Text>
                <Text style={styles.rarityLabel}>LEGENDARY ITEM</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.choiceBtn}
              onPress={handleKeepItem}
              activeOpacity={0.7}
            >
              <View style={styles.btnIconBox}>
                <Package size={24} color="#FFFFFF" />
              </View>
              <View style={styles.btnTextBox}>
                <Text style={styles.btnTitle}>Keep the Item</Text>
                <Text style={styles.btnSubtitle}>
                  {reward.requires_shipping ? "We'll ship it to you" : "Instant access to digital item"}
                </Text>
              </View>
              <ChevronRight size={20} color="#71717A" />
            </TouchableOpacity>

            <TouchableOpacity
              style={flattenStyle([styles.choiceBtn, styles.cashoutBtnHighlight])}
              onPress={handleCashoutChoice}
              activeOpacity={0.7}
            >
              <View style={flattenStyle([styles.btnIconBox, styles.goldBg])}>
                <DollarSign size={24} color="#1A1A2E" />
              </View>
              <View style={styles.btnTextBox}>
                <Text style={styles.goldBtnTitle}>Cash Out ${reward.cashout_value.toFixed(2)}</Text>
                <Text style={styles.btnSubtitle}>Sent to your PayPal account</Text>
              </View>
              <ChevronRight size={20} color="#FACC15" />
            </TouchableOpacity>
          </View>
        );

      case 'keep_form':
        return (
          <View style={styles.content}>
            <Text style={styles.whiteTitle}>Shipping Details</Text>
            <Text style={styles.subtitle}>Enter your details so we can ship your {reward.title}.</Text>

            <View style={styles.fullWidth}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <View style={styles.inputRow}>
                <User size={18} color="#71717A" />
                <TextInput
                  placeholder="John Doe"
                  placeholderTextColor="#71717A"
                  value={shippingName}
                  onChangeText={setShippingName}
                  style={styles.textInput}
                />
              </View>
            </View>

            <View style={styles.fullWidth}>
              <Text style={styles.inputLabel}>Complete Address</Text>
              <View style={[styles.inputRow, { alignItems: 'flex-start', paddingTop: 12, height: 100 }]}>
                <MapPin size={18} color="#71717A" style={{ marginTop: 2 }} />
                <TextInput
                  placeholder="Street, City, Zip, Country"
                  placeholderTextColor="#71717A"
                  value={shippingAddress}
                  onChangeText={setShippingAddress}
                  multiline
                  numberOfLines={4}
                  style={[styles.textInput, { textAlignVertical: 'top' }]}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtnView, loading ? styles.primaryBtnDisabled : null]}
              onPress={finalizeKeepItem}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.primaryBtnText}>Claim Reward</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep('choice')} disabled={loading}>
              <Text style={styles.backText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        );

      case 'cashout_form':
        return (
          <View style={styles.content}>
            <Text style={styles.goldTitleText}>PayPal Cash Out</Text>
            <Text style={styles.subtitle}>Enter your PayPal email to receive ${reward.cashout_value.toFixed(2)}.</Text>

            <View style={styles.fullWidth}>
              <Text style={styles.inputLabel}>PayPal Email Address</Text>
              <View style={[styles.inputRow, emailError ? styles.inputRowError : null]}>
                <Mail size={18} color="#71717A" />
                <TextInput
                  placeholder="your-email@example.com"
                  placeholderTextColor="#71717A"
                  value={paypalEmail}
                  onChangeText={(val) => {
                    setPaypalEmail(val);
                    if (emailError) setEmailError('');
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.textInput}
                />
              </View>
              {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
            </View>

            <View style={styles.infoBox}>
              <AlertCircle size={16} color="#A1A1AA" />
              <Text style={styles.infoText}>Funds are typically processed within 24-48 hours.</Text>
            </View>

            <TouchableOpacity
              style={[styles.goldBtnView, loading ? styles.primaryBtnDisabled : null]}
              onPress={finalizeCashout}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator color="#1A1A2E" />
                : <Text style={styles.goldBtnViewText}>Confirm Cash Out</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep('choice')} disabled={loading}>
              <Text style={styles.backText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        );

      case 'success':
        return (
          <View style={styles.content}>
            <View style={[styles.iconCircle, { backgroundColor: '#22C55E20', width: 96, height: 96, borderRadius: 48 }]}>
              <CheckCircle2 size={64} color="#22C55E" />
            </View>
            <Text style={styles.whiteTitle}>Success!</Text>
            <Text style={styles.subtitle}>Your request has been received and is being processed.</Text>

            <TouchableOpacity
              style={styles.primaryBtnView}
              onPress={handleClose}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>Great!</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      useRNModal={Platform.OS !== 'web'}
    >
      <ModalBackdrop />
      <ModalContent style={[styles.modalContent, { backgroundColor: '#1E1E38' }]}>
        <ModalCloseButton style={styles.closeBtn}>
          <X size={24} color="#71717A" />
        </ModalCloseButton>
        <ModalBody contentContainerStyle={styles.scrollBody} style={{ backgroundColor: '#1E1E38' }}>
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            style={{ backgroundColor: '#1E1E38' }}
          >
            {renderContent()}
          </ScrollView>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContent: {
    backgroundColor: '#1E1E38',
    borderRadius: 24,
    maxHeight: '90%',
    padding: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2A4A',
  },
  scrollBody: {
    padding: 0,
  },
  scrollContent: {
    paddingBottom: 8,
    flexGrow: 0,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 28,
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#1E1E38',
    gap: 14,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FACC1515',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  centerText: {
    alignItems: 'center',
    textAlign: 'center',
  },
  goldTitle: {
    color: '#FACC15',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  whiteTitle: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#A1A1AA',
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
  },
  goldTitleText: {
    color: '#FACC15',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  previewCard: {
    width: '100%',
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A4A',
    rowGap: 12, columnGap: 12,
    marginVertical: 4,
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#2A2A4A',
  },
  previewTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  rarityLabel: {
    color: '#FACC15',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  fullWidth: {
    width: '100%',
  },
  choiceBtn: {
    width: '100%',
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A4A',
    rowGap: 16, columnGap: 16,
  },
  cashoutBtnHighlight: {
    borderColor: '#FACC15',
    backgroundColor: '#FACC1508',
  },
  btnIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#2A2A4A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldBg: {
    backgroundColor: '#FACC15',
  },
  btnTextBox: {
    flex: 1,
  },
  btnTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  goldBtnTitle: {
    color: '#FACC15',
    fontSize: 16,
    fontWeight: '700',
  },
  btnSubtitle: {
    color: '#71717A',
    fontSize: 13,
  },
  inputLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    marginLeft: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E38',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
  },
  textInput: {
    color: '#FFFFFF',
    fontSize: 15,
    flex: 1,
    marginLeft: 8,
  },
  inputRowError: {
    borderColor: '#EF4444',
  },
  primaryBtnView: {
    backgroundColor: '#EF4444',
    width: '100%',
    height: 52,
    borderRadius: 12,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    backgroundColor: '#EF4444',
    opacity: 0.5,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  goldBtnView: {
    backgroundColor: '#FACC15',
    width: '100%',
    height: 52,
    borderRadius: 12,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldBtnViewText: {
    color: '#1A1A2E',
    fontWeight: 'bold',
    fontSize: 16,
  },
  backText: {
    color: '#71717A',
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 8,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E38',
    padding: 12,
    borderRadius: 12,
    rowGap: 8, columnGap: 8,
    width: '100%',
  },
  infoText: {
    color: '#A1A1AA',
    fontSize: 13,
    flex: 1,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
});