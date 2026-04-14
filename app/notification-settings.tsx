import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Bell, MessageSquare, Users, Gift, Heart, Video } from 'lucide-react-native';
import { useNotifyFemaleOnline } from '@/hooks/useNotifyFemaleOnline';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { profile, user, updateProfile } = useAuth();
  const { enabled: femaleOnlineEnabled, setEnabled: setFemaleOnlineEnabled } = useNotifyFemaleOnline();

  const isMale = profile?.gender?.toLowerCase() === 'male';
  const isFemale = profile?.gender?.toLowerCase() === 'female';

  // ── DM Notifications (all users) ──────────────────────────────────────────
  const [dmNotifyEnabled, setDmNotifyEnabledState] = useState<boolean>(true);
  const [dmNotifyLoading, setDmNotifyLoading] = useState<boolean>(true);

  // ── Female: Chat (male-searching) notify mode ──────────────────────────────
  const [notifyMode, setNotifyMode] = useState<'every' | 'batched' | 'off'>('every');
  const [isSavingNotifyMode, setIsSavingNotifyMode] = useState(false);

  // ── Direct call notifications (all users) ─────────────────────────────────
  const [callNotifyEnabled, setCallNotifyEnabledState] = useState<boolean>(true);
  const [callNotifyLoading, setCallNotifyLoading] = useState<boolean>(true);

  // ── Load settings from profile ─────────────────────────────────────────────
  useEffect(() => {
    if (profile) {
      setDmNotifyEnabledState(profile.notify_enabled !== false);
      setDmNotifyLoading(false);
      setCallNotifyEnabledState(profile.call_notify_enabled !== false);
      setCallNotifyLoading(false);

      const mode = profile.male_search_notify_mode;
      if (mode === 'every' || mode === 'batched' || mode === 'off') {
        setNotifyMode(mode);
      }
    }
  }, [profile]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const setDmNotifyEnabled = useCallback(
    async (value: boolean) => {
      if (!user?.id) return;
      setDmNotifyEnabledState(value);
      await updateProfile({ notify_enabled: value });
    },
    [user?.id, updateProfile]
  );

  const setCallNotifyEnabled = useCallback(
    async (value: boolean) => {
      if (!user?.id) return;
      setCallNotifyEnabledState(value);
      await updateProfile({ call_notify_enabled: value });
    },
    [user?.id, updateProfile]
  );

  const handleNotifyModeChange = async (mode: 'every' | 'batched' | 'off') => {
    if (!user?.id || isSavingNotifyMode) return;
    setNotifyMode(mode);
    setIsSavingNotifyMode(true);
    try {
      await updateProfile({ male_search_notify_mode: mode });
    } catch (_err) {}
    setIsSavingNotifyMode(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <ChevronLeft size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── MESSAGES ──────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionLabelRow}>
            <MessageSquare size={13} color="#6B7280" />
            <Text style={styles.sectionLabel}>MESSAGES</Text>
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>New message received</Text>
              <Text style={styles.settingDesc}>
                Get notified when someone sends you a DM
              </Text>
            </View>
            {dmNotifyLoading ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Switch
                value={dmNotifyEnabled}
                onValueChange={setDmNotifyEnabled}
                trackColor={{ false: '#3F3F5A', true: '#EF4444' }}
                thumbColor={dmNotifyEnabled ? '#FFFFFF' : '#A1A1AA'}
                ios_backgroundColor="#3F3F5A"
              />
            )}
          </View>
        </View>

        {/* ── CALLS ─────────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionLabelRow}>
            <Video size={13} color="#6B7280" />
            <Text style={styles.sectionLabel}>CALLS</Text>
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Incoming call</Text>
              <Text style={styles.settingDesc}>
                Get notified when someone calls you directly
              </Text>
            </View>
            {callNotifyLoading ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Switch
                value={callNotifyEnabled}
                onValueChange={setCallNotifyEnabled}
                trackColor={{ false: '#3F3F5A', true: '#EF4444' }}
                thumbColor={callNotifyEnabled ? '#FFFFFF' : '#A1A1AA'}
                ios_backgroundColor="#3F3F5A"
              />
            )}
          </View>
        </View>

        {/* ── MATCHMAKING — Male users only ─────────────────────────────────── */}
        {isMale && (
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <Heart size={13} color="#6B7280" />
              <Text style={styles.sectionLabel}>MATCHMAKING</Text>
            </View>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Female is searching</Text>
                <Text style={styles.settingDesc}>
                  Get notified when a female user starts searching for a match
                </Text>
              </View>
              <Switch
                value={femaleOnlineEnabled}
                onValueChange={setFemaleOnlineEnabled}
                trackColor={{ false: '#3F3F5A', true: '#EC4899' }}
                thumbColor={femaleOnlineEnabled ? '#FFFFFF' : '#A1A1AA'}
                ios_backgroundColor="#3F3F5A"
              />
            </View>
          </View>
        )}

        {/* ── CHAT NOTIFICATIONS — Female users only ────────────────────────── */}
        {isFemale && (
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <Users size={13} color="#6B7280" />
              <Text style={styles.sectionLabel}>CHAT NOTIFICATIONS</Text>
            </View>
            <Text style={styles.chatNotifySubtitle}>
              How often do you want to be notified when guys start searching?
            </Text>
            <View style={styles.modeOptionsContainer}>
              {/* Every time */}
              <TouchableOpacity
                style={[
                  styles.modeOption,
notifyMode === 'every' ? styles.modeOptionSelected : null,
                ]}
                activeOpacity={0.8}
                onPress={() => handleNotifyModeChange('every')}
              >
                <View style={styles.modeOptionInner}>
                  <View style={[styles.modeRadio,notifyMode === 'every' ? styles.modeRadioSelected : null]}>
                    {notifyMode === 'every' && <View style={styles.modeRadioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modeOptionTitle,notifyMode === 'every' ? styles.modeOptionTitleSelected : null]}>
                      Every time
                    </Text>
                    <Text style={styles.modeOptionDesc}>
                      Get notified every time a guy starts searching
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Batched */}
              <TouchableOpacity
                style={[
                  styles.modeOption,
                  styles.modeOptionBorder,
notifyMode === 'batched' ? styles.modeOptionSelected : null,
                ]}
                activeOpacity={0.8}
                onPress={() => handleNotifyModeChange('batched')}
              >
                <View style={styles.modeOptionInner}>
                  <View style={[styles.modeRadio,notifyMode === 'batched' ? styles.modeRadioSelected : null]}>
                    {notifyMode === 'batched' && <View style={styles.modeRadioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modeOptionTitle,notifyMode === 'batched' ? styles.modeOptionTitleSelected : null]}>
                      Batched
                    </Text>
                    <Text style={styles.modeOptionDesc}>
                      Summary every 30 min (e.g. &apos;5 guys searched&apos;)
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Off */}
              <TouchableOpacity
                style={[
                  styles.modeOption,
                  styles.modeOptionBorder,
notifyMode === 'off' ? styles.modeOptionSelected : null,
                ]}
                activeOpacity={0.8}
                onPress={() => handleNotifyModeChange('off')}
              >
                <View style={styles.modeOptionInner}>
                  <View style={[styles.modeRadio,notifyMode === 'off' ? styles.modeRadioSelected : null]}>
                    {notifyMode === 'off' && <View style={styles.modeRadioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modeOptionTitle,notifyMode === 'off' ? styles.modeOptionTitleSelected : null]}>
                      Off
                    </Text>
                    <Text style={styles.modeOptionDesc}>
                      No male-searching notifications
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
            {isSavingNotifyMode && (
              <ActivityIndicator size="small" color="#EF4444" style={{ marginHorizontal: 16, marginBottom: 12 }} />
            )}
          </View>
        )}

        {/* ── COMING SOON ───────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionLabelRow}>
            <Bell size={13} color="#6B7280" />
            <Text style={styles.sectionLabel}>COMING SOON</Text>
          </View>
          {[
            {
              id: 'liked_profile',
              label: 'Someone liked your profile',
              desc: 'Be alerted when a user shows interest',
            },
            {
              id: 'gift_received',
              label: 'Gift received',
              desc: 'Know immediately when someone gifts you minutes',
            },
          ].map((toggle, i, arr) => (
            <View
              key={toggle.id}
              style={[
                styles.settingRow,
                i >0 ? styles.settingRowBorder : null,
              ]}
            >
              <View style={styles.settingInfo}>
                <View style={styles.labelRow}>
                  <Text style={styles.settingTitle}>{toggle.label}</Text>
                  <View style={styles.comingSoonBadge}>
                    <Text style={styles.comingSoonText}>Soon</Text>
                  </View>
                </View>
                <Text style={styles.settingDesc}>{toggle.desc}</Text>
              </View>
              <Switch
                value={false}
                onValueChange={() => {}}
                disabled
                trackColor={{ false: '#3F3F5A', true: '#EF4444' }}
                thumbColor="#5A5A7A"
                ios_backgroundColor="#3F3F5A"
              />
            </View>
          ))}
        </View>

        <Text style={styles.footerNote}>
          More notification options coming in a future update.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  backBtn: {
    width: 40,
    alignItems: 'flex-start',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  section: {
    marginTop: 24,
    marginHorizontal: 20,
    backgroundColor: '#1E1E38',
    borderRadius: 16,
    overflow: 'hidden',
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    rowGap: 6, columnGap: 6,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  sectionLabel: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    rowGap: 12, columnGap: 12,
  },
  settingRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#2A2A4A',
  },
  settingInfo: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    rowGap: 8, columnGap: 8,
    flexWrap: 'wrap',
  },
  settingTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
  },
  settingDesc: {
    color: '#A1A1AA',
    fontSize: 12,
    lineHeight: 17,
  },
  // ── Chat notification mode picker ────────────────────────────────────────
  chatNotifySubtitle: {
    color: '#A1A1AA',
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  modeOptionsContainer: {
    marginHorizontal: 0,
    marginBottom: 4,
  },
  modeOption: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modeOptionBorder: {
    borderTopWidth: 1,
    borderTopColor: '#2A2A4A',
  },
  modeOptionSelected: {
    backgroundColor: '#2A1A2E',
  },
  modeOptionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    rowGap: 12, columnGap: 12,
  },
  modeRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#52525B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeRadioSelected: {
    borderColor: '#EF4444',
  },
  modeRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  modeOptionTitle: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  modeOptionTitleSelected: {
    color: '#FFFFFF',
  },
  modeOptionDesc: {
    color: '#A1A1AA',
    fontSize: 12,
    lineHeight: 17,
  },
  // ── Coming soon badge ────────────────────────────────────────────────────
  comingSoonBadge: {
    backgroundColor: '#2D2D4A',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#4F46E5',
  },
  comingSoonText: {
    color: '#818CF8',
    fontSize: 10,
    fontWeight: '700',
  },
  footerNote: {
    color: '#4B5563',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 28,
    marginHorizontal: 32,
  },
});