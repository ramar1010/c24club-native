import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { X } from 'lucide-react-native';

export type LegalPage = 'terms' | 'privacy' | 'safety';

interface LegalModalProps {
  visible: boolean;
  page: LegalPage | null;
  onClose: () => void;
}

// ─── Content ──────────────────────────────────────────────────────────────────

const TERMS_CONTENT = [
  { type: 'h1', text: 'Terms & Conditions' },
  { type: 'p', text: 'This document is a legally binding agreement between Cyber Media Rush LLC, doing business as C24 Club ("we," "us," or "ours"), and you, the user. By accessing or using our platform, you agree to comply with this Agreement.' },
  { type: 'p', text: 'By using C24 Club, you confirm that you are at least 18 years of age, or older.' },
  { type: 'warning', text: '⚠️ If you are under 18 years of age, your access to this platform is strictly prohibited. If we determine that you are under 18, we reserve the right to take immediate action, including notifying your legal guardians and potentially pursuing further legal measures.' },

  { type: 'h2', text: '1. Gaining Access' },
  { type: 'bullet', text: 'We grant you a non-exclusive, non-transferable, and revocable license to access and use the platform.' },
  { type: 'bullet', text: 'Your rights under this agreement cannot be transferred or assigned to others.' },
  { type: 'bullet', text: 'This agreement does not create any partnership, employment relationship, or agency between you and C24 Club.' },

  { type: 'h2', text: '2. Website Availability' },
  { type: 'bullet', text: 'C24 Club may be temporarily unavailable due to maintenance, updates, or technical issues. We are not responsible for damages during these periods.' },
  { type: 'bullet', text: 'We reserve the right to modify, suspend, or discontinue the website at any time without prior notice.' },

  { type: 'h2', text: '3. User Content Licensing' },
  { type: 'bullet', text: 'By submitting content on C24 Club, you grant us a worldwide, non-exclusive, royalty-free license to use, modify, distribute, and display your content.' },
  { type: 'bullet', text: 'You retain ownership of your content.' },
  { type: 'bullet', text: 'You are responsible for ensuring your content does not infringe on third-party rights.' },

  { type: 'h2', text: '4. Malicious Activity' },
  { type: 'p', text: 'Users are prohibited from:' },
  { type: 'bullet', text: 'Attempting to breach platform security or test vulnerabilities.' },
  { type: 'bullet', text: 'Using automated bots or crawlers to extract data.' },
  { type: 'bullet', text: 'Attempting to reverse-engineer platform software.' },
  { type: 'bullet', text: 'Disrupting the platform through attacks or spamming.' },

  { type: 'h2', text: '5. Paid Products & Services' },
  { type: 'p', text: 'C24 Club offers paid products including VIP memberships, ad point packages, spin purchases, and unfreeze payments. By purchasing, you agree to provide accurate payment info, honor all charges, and use only valid payment methods.' },
  { type: 'p', text: 'Paid products are non-transferable unless explicitly stated. All payments are subject to our Refund Policy.' },

  { type: 'h2', text: '8. Termination of Access' },
  { type: 'bullet', text: 'Users who violate terms may have access limited, suspended, or permanently revoked without prior notice.' },
  { type: 'bullet', text: 'C24 Club reserves the right to block users or IP addresses involved in prohibited activities.' },

  { type: 'h2', text: '9. Limitation of Liability' },
  { type: 'bullet', text: 'C24 Club is not responsible for any actions taken by users, nor liable for damages including service interruptions or data loss.' },
  { type: 'bullet', text: 'You agree to indemnify C24 Club against any claims resulting from your actions on the platform.' },

  { type: 'h2', text: '13. Earning Minutes' },
  { type: 'bullet', text: 'Users earn reward minutes by participating in video calls. Every 5 minutes in a call earns reward minutes automatically.' },
  { type: 'bullet', text: 'Standard members earn up to 10 minutes per partner; VIP members earn up to 30 minutes per partner.' },
  { type: 'bullet', text: 'Quick-skipping calls reduces earning potential.' },
  { type: 'bullet', text: 'Minutes may be frozen if certain thresholds are met.' },

  { type: 'h2', text: '16. Reward Fulfillment' },
  { type: 'bullet', text: 'C24 Club is responsible for the fulfillment of all rewards.' },
  { type: 'bullet', text: 'Rewards are sourced from third-party sellers. C24 Club does not control shipping times or item quality.' },
  { type: 'bullet', text: 'If an item is not delivered, C24 Club will provide 400+ extra minutes or allow users to rechoose their reward.' },

  { type: 'h2', text: '20. VIP Membership' },
  { type: 'bullet', text: 'C24 Club offers VIP membership tiers with recurring billing via Stripe.' },
  { type: 'bullet', text: 'VIP subscriptions auto-renew unless cancelled before the billing cycle ends.' },
  { type: 'bullet', text: 'C24 Club may modify VIP tier pricing, benefits, and availability at any time.' },

  { type: 'h2', text: '21. Eligibility' },
  { type: 'p', text: 'Misuse that may result in disqualification includes: creating multiple accounts, using bots or scripts, using VPNs to bypass restrictions, showing a black screen or pre-recorded video to farm minutes.' },

  { type: 'h2', text: '27. NSFW Detection & Bans' },
  { type: 'bullet', text: 'C24 Club employs automated NSFW and black screen detection. Users displaying inappropriate content may receive strikes or be automatically banned.' },
  { type: 'bullet', text: 'Banned users may have the option to pay an unban fee to regain access.' },

  { type: 'h2', text: 'Refund Policy' },
  { type: 'p', text: 'Refunds will generally not be issued once a service has been provided or a digital good has been delivered, including ad points, VIP memberships, spin purchases, or unfreeze payments.' },
  { type: 'bullet', text: 'Technical issues: partial or full refund may be issued. Report within 3 days of purchase.' },
  { type: 'bullet', text: 'Duplicate payments: full refund after verification.' },
  { type: 'bullet', text: 'Change of mind: no refunds once payment is made and service delivered.' },
  { type: 'bullet', text: 'VIP users banned for violating guidelines receive no refund.' },

  { type: 'h2', text: 'Contact' },
  { type: 'p', text: 'For questions about these Terms, contact us at business@c24club.com.' },
  { type: 'spacer', text: '' },
  { type: 'p', text: 'Apple is not a sponsor of, nor is it involved in any way with, the rewards or contests within this app.' },
];

const PRIVACY_CONTENT = [
  { type: 'h1', text: 'Privacy Policy' },
  { type: 'p', text: 'This Privacy Policy describes how Cyber Media Rush LLC, doing business as C24 Club, collects, uses, and protects your personal information when you use our platform.' },

  { type: 'h2', text: '1. Information Collection & Use' },
  { type: 'bullet', text: 'C24 Club collects users\' names, email addresses, and shipping addresses (when redeeming physical rewards).' },
  { type: 'bullet', text: 'Information is used to process rewards, manage accounts, and improve our services.' },

  { type: 'h2', text: '2. Third-Party Sharing' },
  { type: 'bullet', text: 'Shipping information may be shared with third-party sellers solely for shipping rewards.' },
  { type: 'bullet', text: 'C24 Club uses third-party sites to provide gift cards as rewards.' },
  { type: 'bullet', text: 'Promo data may be shared with third-party service providers for analytics, subject to confidentiality agreements.' },

  { type: 'h2', text: '3. Data Security' },
  { type: 'bullet', text: 'C24 Club is committed to protecting user information with appropriate measures against unauthorized access.' },
  { type: 'bullet', text: 'All user content submitted for challenges is handled in compliance with CCPA and GDPR.' },
  { type: 'bullet', text: 'Screenshots submitted for weekly challenges are retained for a maximum of 30 days then permanently deleted.' },

  { type: 'h2', text: '4. Social/Pay App Privacy' },
  { type: 'bullet', text: 'When users pin social/pay apps, their personal information may be shared with other users. C24 Club is not responsible for how others use this information.' },
  { type: 'bullet', text: 'Users should review third-party app privacy policies.' },

  { type: 'h2', text: '5. Screen Recording & Privacy' },
  { type: 'bullet', text: 'Users acknowledge that their interactions may be recorded by other users.' },
  { type: 'bullet', text: 'C24 Club is not liable for privacy violations resulting from screen recordings but will investigate and take action against violators.' },

  { type: 'h2', text: '7. Your CCPA Rights' },
  { type: 'bullet', text: 'Right to Know: You have the right to know what personal information we collect and why.' },
  { type: 'bullet', text: 'Right to Delete: You may request deletion of your personal information by contacting business@c24club.com.' },
  { type: 'bullet', text: 'Right to Opt-Out: C24 Club does not currently sell personal information.' },
  { type: 'bullet', text: 'Right to Non-Discrimination: We will not discriminate against you for exercising your CCPA rights.' },

  { type: 'h2', text: '10. Protection of Minors' },
  { type: 'bullet', text: 'C24 Club does not knowingly collect personal information from users under 18.' },
  { type: 'bullet', text: 'If we discover a minor has provided information, we will delete it and terminate the account.' },

  { type: 'h2', text: '11. SMS Session Reminders' },
  { type: 'bullet', text: 'When you opt in to SMS, we collect your phone number solely for sending session reminder messages.' },
  { type: 'bullet', text: 'We will never sell, rent, or share your phone number with any third party other than our SMS delivery provider.' },
  { type: 'bullet', text: 'Opt out anytime by replying STOP to any message.' },

  { type: 'h2', text: '13. Updates to This Policy' },
  { type: 'p', text: 'C24 Club may update this Privacy Policy from time to time. Continuing to use the platform after changes constitutes acceptance of the updated policy.' },

  { type: 'h2', text: 'Contact' },
  { type: 'p', text: 'For questions about this Privacy Policy, contact us at business@c24club.com.' },
];

const SAFETY_CONTENT = [
  { type: 'h1', text: 'Safety Center' },
  { type: 'p', text: 'C24 Club is built with multiple layers of protection to keep you safe while video chatting. Here\'s how our platform protects you and what you can do to stay safe.' },

  { type: 'h2', text: 'Built-In Platform Protections' },

  { type: 'h3', text: '🔒 End-to-End Encrypted Calls' },
  { type: 'p', text: 'All video calls use WebRTC with mandatory DTLS-SRTP encryption. Your video and audio are encrypted in transit — not even C24 Club can see your call content.' },

  { type: 'h3', text: '🛡️ 4-Second Pre-Blur Shield' },
  { type: 'p', text: 'Every time you connect with a new partner, the remote video is blurred for 4 seconds. This gives you a safe transition period before you see or are fully visible to your match.' },

  { type: 'h3', text: '🤖 AI-Powered NSFW Detection' },
  { type: 'p', text: 'Our system uses AI moderation to detect inappropriate content in real time. Users who violate content rules receive automatic strikes and can be banned from the platform.' },

  { type: 'h3', text: '🚫 Automatic Ban System' },
  { type: 'p', text: 'Users who violate community rules are automatically flagged and banned. Repeated NSFW strikes lead to permanent bans, including IP-level blocking.' },

  { type: 'h3', text: '📢 One-Tap Reporting' },
  { type: 'p', text: 'During any video call, you can instantly report a user by tapping the report icon. Select a reason, add details, and our moderation team will review it promptly.' },

  { type: 'h2', text: 'How to Stay Safe' },

  { type: 'h3', text: '01 · Never Share Personal Information' },
  { type: 'p', text: 'Don\'t share your real name, address, phone number, school, workplace, or any identifying details during video calls. Keep conversations fun but anonymous.' },

  { type: 'h3', text: '02 · Use Voice Mode If Uncomfortable' },
  { type: 'p', text: 'C24 Club supports Voice Mode — you can chat with your camera off using an avatar. Use this if you ever feel uncomfortable showing your face.' },

  { type: 'h3', text: '03 · Skip Immediately If Something Feels Wrong' },
  { type: 'p', text: 'Trust your instincts. If a conversation makes you uncomfortable, hit the skip button immediately. There\'s no penalty for protecting yourself.' },

  { type: 'h3', text: '04 · Report Inappropriate Behavior' },
  { type: 'p', text: 'Use the report button during any call to flag users who are being inappropriate, harassing, or breaking rules.' },

  { type: 'h3', text: '05 · Don\'t Click Suspicious Links' },
  { type: 'p', text: 'If someone shares a link during a call or in messages, be cautious. Never click links from strangers that ask for personal information or downloads.' },

  { type: 'h3', text: '06 · Use Strong, Unique Passwords' },
  { type: 'p', text: 'Protect your C24 Club account with a strong password that you don\'t use on other sites.' },

  { type: 'h3', text: '07 · Be Aware of Screen Recording' },
  { type: 'p', text: 'While C24 Club prohibits unauthorized recording, always behave as if you could be recorded. Never do or show anything on camera that you wouldn\'t want shared publicly.' },

  { type: 'h3', text: '08 · Don\'t Send Money to Strangers' },
  { type: 'p', text: 'The only monetary features on C24 Club are official platform features like gifting minutes and purchasing VIP. Never send money, gift cards, or cryptocurrency to someone you met on the platform.' },

  { type: 'h2', text: 'Age Requirement' },
  { type: 'p', text: 'C24 Club is strictly for users aged 18 and older. If you are a parent or guardian and believe your child has accessed C24 Club, please contact us immediately.' },

  { type: 'h2', text: 'What To Do If Something Goes Wrong' },
  { type: 'h3', text: 'If someone is being inappropriate:' },
  { type: 'p', text: 'Skip the call immediately and use the report button. Our AI moderation system may have already flagged them, but your report helps confirm and speed up action.' },

  { type: 'h3', text: 'If someone threatens you:' },
  { type: 'p', text: 'End the call, report the user, and if you feel in immediate danger, contact your local law enforcement. C24 Club cooperates with authorities when required by law.' },

  { type: 'h3', text: 'If someone asks for personal info or money:' },
  { type: 'p', text: 'Never comply. This is likely a scam. Skip the call, report the user, and remember C24 Club staff will never ask for your password, payment info, or personal details.' },
  { type: 'spacer', text: '' },
  { type: 'p', text: 'Apple is not a sponsor of, nor is it involved in any way with, the rewards or contests within this app.' },
];

const PAGE_CONTENT: Record<LegalPage, typeof TERMS_CONTENT> = {
  terms: TERMS_CONTENT,
  privacy: PRIVACY_CONTENT,
  safety: SAFETY_CONTENT,
};

// ─── Renderer ─────────────────────────────────────────────────────────────────

function renderContent(items: typeof TERMS_CONTENT) {
  return items.map((item, i) => {
    switch (item.type) {
      case 'h1':
        return <Text key={i} style={styles.h1}>{item.text}</Text>;
      case 'h2':
        return <Text key={i} style={styles.h2}>{item.text}</Text>;
      case 'h3':
        return <Text key={i} style={styles.h3}>{item.text}</Text>;
      case 'bullet':
        return (
          <View key={i} style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>{item.text}</Text>
          </View>
        );
      case 'warning':
        return (
          <View key={i} style={styles.warningBox}>
            <Text style={styles.warningText}>{item.text}</Text>
          </View>
        );
      case 'spacer':
        return <View key={i} style={{ height: 20 }} />;
      default:
        return <Text key={i} style={styles.p}>{item.text}</Text>;
    }
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LegalModal({ visible, page, onClose }: LegalModalProps) {
  const content = page ? PAGE_CONTENT[page] : null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {page === 'terms' ? 'Terms & Conditions' : page === 'privacy' ? 'Privacy Policy' : 'Safety Center'}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {content && renderContent(content)}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A4A',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A2A4A',
    borderRadius: 18,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  h1: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 12,
  },
  h2: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 24,
    marginBottom: 8,
  },
  h3: {
    color: '#FACC15',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 4,
  },
  p: {
    color: '#D1D5DB',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 4,
  },
  bulletDot: {
    color: '#EF4444',
    fontSize: 13,
    marginRight: 8,
    lineHeight: 20,
  },
  bulletText: {
    color: '#D1D5DB',
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  warningBox: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
    borderRadius: 8,
    padding: 12,
    marginVertical: 10,
  },
  warningText: {
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 20,
  },
});