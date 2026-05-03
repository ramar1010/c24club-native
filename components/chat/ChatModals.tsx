import React from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui/text';
import SelfieCaptureModal from '@/components/SelfieCaptureModal';
import { GiftCelebration } from '@/components/GiftCelebration';
import { flattenStyle } from '@/utils/flatten-style';
import styles from './chat-styles';

// ─── Report Modal ─────────────────────────────────────────────────────────────
interface ReportModalProps {
  visible: boolean;
  reportReason: string;
  reportDetails: string;
  reportSubmitted: boolean;
  reportSubmitting: boolean;
  onClose: () => void;
  onReasonSelect: (reason: string) => void;
  onDetailsChange: (text: string) => void;
  onSubmit: () => void;
}

export function ReportModal({
  visible,
  reportReason,
  reportDetails,
  reportSubmitted,
  reportSubmitting,
  onClose,
  onReasonSelect,
  onDetailsChange,
  onSubmit,
}: ReportModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.reportModalOverlay}>
        <View style={styles.reportSheet}>
          <View style={styles.reportHeader}>
            <Text style={styles.reportTitle}>Report User</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color="#A1A1AA" />
            </TouchableOpacity>
          </View>

          {reportSubmitted ? (
            <View style={styles.reportSuccess}>
              <Text style={styles.reportSuccessText}>✅ Report submitted. Thank you!</Text>
            </View>
          ) : (
            <>
              <View style={styles.reportGrid}>
                {[
                  'Underage User',
                  'Inappropriate Behavior',
                  'Nudity / Sexual Content',
                  'Harassment / Bullying',
                  'Hate Speech / Discrimination',
                  'Spam / Scam',
                  'Violence / Threats',
                  'Other',
                ].map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    style={flattenStyle([
                      styles.reportReasonBtn,
                      reportReason === reason ? styles.reportReasonBtnActive : null,
                    ])}
                    onPress={() => onReasonSelect(reason)}
                    activeOpacity={0.8}
                  >
                    <Text style={flattenStyle([
                      styles.reportReasonText,
                      reportReason === reason ? styles.reportReasonTextActive : null,
                    ])}>
                      {reason}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.reportDetailsInput}
                placeholder="Additional details..."
                placeholderTextColor="#555"
                multiline
                maxLength={500}
                value={reportDetails}
                onChangeText={onDetailsChange}
              />

              <TouchableOpacity
                style={flattenStyle([styles.modalRedBtn, { marginTop: 12 }, !reportReason ? styles.disabledBtn : null])}
                onPress={onSubmit}
                activeOpacity={0.85}
                disabled={!reportReason || reportSubmitting}
              >
                {reportSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalRedBtnText}>Submit Report</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Skip Penalty Modal ───────────────────────────────────────────────────────
interface SkipPenaltyModalProps {
  visible: boolean;
  onClose: () => void;
}

export function SkipPenaltyModal({ visible, onClose }: SkipPenaltyModalProps) {
  const router = useRouter();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>⚠️ -2 Minutes Deducted</Text>
          <Text style={styles.modalSubtitle}>
            Stop quick-skipping or upgrade to VIP for unlimited skips
          </Text>
          <TouchableOpacity
            style={styles.modalRedBtn}
            onPress={() => { onClose(); router.push('/vip'); }}
            activeOpacity={0.85}
          >
            <Text style={styles.modalRedBtnText}>Upgrade to VIP ($2.49/wk)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalGrayBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.modalGrayBtnText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Freeze / Cap Modal ───────────────────────────────────────────────────────
interface FreezeModalProps {
  visible: boolean;
  showCapPopup: boolean;
  isFrozen: boolean;
  unfreezeLoading: boolean;
  onClose: () => void;
  onUpgradeVip: () => void;
  onOneTimeUnfreeze: () => void;
  onRemindLater: () => void;
}

export function FreezeModal({
  visible,
  showCapPopup,
  isFrozen,
  unfreezeLoading,
  onClose,
  onUpgradeVip,
  onOneTimeUnfreeze,
  onRemindLater,
}: FreezeModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => { if (!unfreezeLoading) onClose(); }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>🥶 Your Minutes Are Frozen</Text>
          <Text style={styles.modalSubtitle}>
            {showCapPopup
              ? `You've hit your ${isFrozen ? 'freeze' : 'session'} minute cap. ${isFrozen ? 'While frozen, you can only earn 2 minutes per session. ' : ''}Upgrade to VIP for 3× more minutes per session, or do a one-time unfreeze.`
              : "Your minutes are frozen because you've hit the freeze threshold. Unfreeze to continue earning. While frozen, you can only earn 2 minutes per session."}
          </Text>
          <TouchableOpacity
            style={styles.modalRedBtn}
            onPress={onUpgradeVip}
            activeOpacity={0.85}
            disabled={unfreezeLoading}
          >
            <Text style={styles.modalRedBtnText}>VIP Unfreeze ($2.49/wk)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={flattenStyle([styles.modalGrayBtn, { borderColor: '#FACC15' }, unfreezeLoading ? styles.disabledBtn : null])}
            onPress={onOneTimeUnfreeze}
            activeOpacity={0.8}
            disabled={unfreezeLoading}
          >
            {unfreezeLoading ? (
              <ActivityIndicator size="small" color="#FACC15" />
            ) : (
              <Text style={flattenStyle([styles.modalGrayBtnText, { color: '#FACC15' }])}>One-Time Unfreeze ($1.99)</Text>
            )}
          </TouchableOpacity>
          {!unfreezeLoading && (
            <>
              <TouchableOpacity onPress={onRemindLater} activeOpacity={0.7} style={{ marginTop: 8, alignItems: 'center' }}>
                <Text style={styles.remindLaterText}>Remind me in 2 days</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalGrayBtn} onPress={onClose} activeOpacity={0.8}>
                <Text style={styles.modalGrayBtnText}>Keep Chatting</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Pending Selfie Modal ─────────────────────────────────────────────────────
interface PendingPopupProps {
  visible: boolean;
  onClose: () => void;
  onStartChatting: () => void;
}

export function PendingPopup({ visible, onClose, onStartChatting }: PendingPopupProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>🎉 Selfie Submitted!</Text>
          <Text style={styles.modalSubtitle}>
            Your selfie is pending review by our team. You can start chatting right now while you wait — it usually takes just a few minutes!
          </Text>
          <TouchableOpacity
            style={styles.modalRedBtn}
            onPress={onStartChatting}
            activeOpacity={0.85}
          >
            <Text style={styles.modalRedBtnText}>Start Chatting Now 🚀</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalGrayBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.modalGrayBtnText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Gift Overlay Modal ───────────────────────────────────────────────────────
interface GiftOverlayProps {
  visible: boolean;
  partnerName: string;
  giftLoading: string | null;
  onClose: () => void;
  onGiftTier: (tier: string) => void;
}

export function GiftOverlay({ visible, partnerName, giftLoading, onClose, onGiftTier }: GiftOverlayProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.giftModalOverlay}>
        <View style={styles.giftModalCard}>
          <TouchableOpacity style={styles.giftCloseBtn} onPress={onClose} activeOpacity={0.8}>
            <X size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.giftModalTitle}>🎁 SEND CASH TO THIS USER!</Text>
          <Text style={styles.giftModalSubtitle}>Send cash to {partnerName}</Text>
          <Text style={styles.giftModalPaypal}>💵 They receive real cash via PayPal</Text>

          {[
            { tier: '100', label: 'Gift $1.00 Cash', sublabel: '100 Minutes • You pay $1.99', bonus: null },
            { tier: '400', label: 'Gift $4.00 Cash', sublabel: '400 Minutes • You pay $4.99', bonus: 'Send $4.00 Cash & Get +100 Minutes Back!' },
            { tier: '600', label: 'Gift $6.00 Cash', sublabel: '600 Minutes • You pay $7.99', bonus: 'Send $6.00 Cash & Get +150 Minutes Back!' },
            { tier: '1000', label: 'Gift $10.00 Cash', sublabel: '1000 Minutes • You pay $12.99', bonus: 'Send $10.00 Cash & Get +250 Minutes Back!' },
          ].map(({ tier, label, sublabel, bonus }) => (
            <View key={tier} style={styles.giftTierWrapper}>
              <TouchableOpacity
                style={styles.giftTierBtn}
                onPress={() => onGiftTier(tier)}
                activeOpacity={0.85}
                disabled={giftLoading !== null}
              >
                {giftLoading === tier ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <View style={styles.giftTierContent}>
                    <Text style={styles.giftTierLabel}>{label}</Text>
                    <Text style={styles.giftTierSublabel}>{sublabel}</Text>
                  </View>
                )}
              </TouchableOpacity>
              {bonus && <Text style={styles.giftTierBonus}>{bonus}</Text>}
            </View>
          ))}

          <Text style={styles.giftNoRefund}>NO REFUND POLICY</Text>
        </View>
      </View>
    </Modal>
  );
}

// ─── Banned Overlay ───────────────────────────────────────────────────────────
interface BannedOverlayProps {
  visible: boolean;
  banReason: string;
  banDate: string;
}

export function BannedOverlay({ visible, banReason, banDate }: BannedOverlayProps) {
  if (!visible) return null;
  return (
    <View style={styles.bannedOverlay}>
      <View style={styles.bannedContent}>
        <Text style={styles.bannedIcon}>🚫</Text>
        <Text style={styles.bannedTitle}>You are banned</Text>
        <Text style={styles.bannedReason}>{banReason}</Text>
        {banDate ? <Text style={styles.bannedDate}>Since: {banDate}</Text> : null}
      </View>
    </View>
  );
}

// ─── Minute Loss Toast ────────────────────────────────────────────────────────
interface MinuteLossToastProps {
  visible: boolean;
}

export function MinuteLossToast({ visible }: MinuteLossToastProps) {
  if (!visible) return null;
  return (
    <View style={styles.minuteLossToast} pointerEvents="none">
      <Text style={styles.minuteLossToastText}>🚫 -2 Minutes / Don't Quick Skip</Text>
    </View>
  );
}

// ─── Selfie Capture Modal (re-exported for convenience) ──────────────────────
export { SelfieCaptureModal };

// ─── Gift Celebration (re-exported for convenience) ──────────────────────────
export { GiftCelebration };