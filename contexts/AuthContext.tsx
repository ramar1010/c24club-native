import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { storage } from "@/lib/storage";
import { registerForPushNotifications, setupNotificationListeners } from "@/lib/notifications";

export interface MemberProfile {
  id: string;
  name: string;
  email: string;
  image_url: string | null;
  image_thumb_url: string | null;
  image_status: string | null;
  bio: string | null;
  gender: string | null;
  is_discoverable: boolean;
  notify_enabled: boolean;
  notify_female_searching: boolean;
  call_notify_enabled: boolean;
  male_search_notify_mode: 'every' | 'batched' | 'off';
  push_token: string | null;
  membership: string | null;
  title: string | null;
  birthdate: string | null;
  city: string | null;
  country: string | null;
  state: string | null;
  profession: string | null;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
  call_slug: string | null;
  zip: string | null;
  phone_number: string | null;
  shipping_name: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip: string | null;
  shipping_country: string | null;
}

export interface MemberMinutes {
  id: string;
  user_id: string;
  minutes: number;
  total_minutes: number; // TOTAL SPENDABLE BALANCE (minutes + gifted + ad)
  lifetime_earned: number; // LIFETIME CHATTING MINUTES EARNED
  ad_points: number;
  gifted_minutes: number;
  is_vip: boolean;
  vip_tier: 'basic' | 'premium' | null;
  admin_granted_vip?: boolean; // Added for video call logic
  chance_enhancer: number;
  ce_minutes_checkpoint: number;
  // Login streak & decay
  login_streak: number;
  last_streak_login_at: string | null;
  // Freeze system fields
  is_frozen: boolean;
  frozen_at: string | null;
  freeze_free_until: string | null;
  vip_unfreezes_used: number;
  vip_unfreezes_reset_at: string | null;
  frozen_cap_popup_shown: boolean;
}

export interface Reward {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  minutes_cost: number;
  rarity: 'common' | 'rare' | 'legendary';
  cashout_value: number;
  category_id: string | null;
  stock_quantity: number;
  is_vip_only: boolean;
  target_gender: string | null;
}

export interface FreezeSettings {
  minute_threshold: number;
  frozen_earn_rate: number;
  one_time_unfreeze_price: number;
  vip_unfreezes_per_month: number;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: MemberProfile | null;
  minutes: MemberMinutes | null;
  freezeSettings: FreezeSettings | null;
  loading: boolean;
  debugLogs: string[];
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateMinutes: (updates: Partial<MemberMinutes>) => Promise<void>;
  updateProfile: (updates: Partial<MemberProfile>) => Promise<void>;
  syncVipStatus: () => Promise<void>;
  updateMinutesFromRow: (row: any) => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  minutes: null,
  freezeSettings: null,
  loading: true,
  debugLogs: [],
  signOut: async () => {},
  refreshProfile: async () => {},
  updateMinutes: async () => {},
  updateProfile: async () => {},
  syncVipStatus: async () => {},
  updateMinutesFromRow: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [minutes, setMinutes] = useState<MemberMinutes | null>(null);
  const [freezeSettings, setFreezeSettings] = useState<FreezeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  // Local storage for shipping address since it's missing in DB
  const loadLocalAddress = useCallback(async (profileData: MemberProfile) => {
    try {
      const saved = await storage.getItem(`shipping_address_${profileData.id}`);
      if (saved) {
        const addr = JSON.parse(saved);
        if (addr && typeof addr === 'object') {
          setProfile(prev => prev ? { ...prev, ...addr } : null);
        }
      }
    } catch (e) {
      console.error("[AuthProvider] Error loading local address:", e);
    }
  }, []);

  useEffect(() => {
    console.log("[AuthProvider] EFFECT MOUNTED");
    let isMounted = true;

    const initializeAuth = async () => {
      console.log("[AuthProvider] initializeAuth attempt...");
      // Avoid running getSession during SSR on web to prevent hangs
      if (Platform.OS === 'web' && typeof window === 'undefined') {
        console.log("[AuthProvider] SSR Detected, skipping getSession");
        setLoading(false);
        return;
      }

      try {
        console.log("[AuthProvider] Calling supabase.auth.getSession()...");
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        console.log("[AuthProvider] getSession result:", { 
          hasSession: !!currentSession,
          uid: currentSession?.user?.id,
          error: sessionError?.message
        });
        
        if (!isMounted) return;
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          await fetchUserData(currentSession.user.id, currentSession.user);
        }
      } catch (err: any) {
        console.warn("[AuthProvider] Error in initializeAuth:", err.message);
      } finally {
        if (isMounted) {
          console.log("[AuthProvider] Finalizing initializeAuth (loading -> false)");
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const cleanupNotifications = setupNotificationListeners((response) => {
      const deepLink = response.notification.request.content.data?.deepLink;
      if (deepLink) {
        setTimeout(() => {
          try {
            const { router } = require('expo-router');
            router.push(deepLink as string);
          } catch (_) {}
        }, 500);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isMounted) return;
        const currentUser = newSession?.user ?? null;
        console.log(`[AuthProvider] onAuthStateChange: ${event}`, { 
          uid: currentUser?.id, 
          email: currentUser?.email 
        });

        // TOKEN_REFRESHED: update session/user but don't re-fetch profile data
        if (event === "TOKEN_REFRESHED") {
          setSession(newSession);
          setUser(currentUser);
          return;
        }
        
        setSession(newSession);
        setUser(currentUser);

        if (currentUser && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED")) {
           console.log(`[AuthProvider] Fetching data for ${event}...`);
           setLoading(true); // Ensure loading is true when fetching data

           // Add a safety timeout to ensure loading state doesn't hang forever on slow connections
           const fetchPromise = fetchUserData(currentUser.id, currentUser);
           const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 15000));

           Promise.race([fetchPromise, timeoutPromise]).finally(() => {
             if (isMounted) {
               console.log(`[AuthProvider] Finalizing loading for ${event}`);
               setLoading(false);
             }
           });
        } else if (event === "SIGNED_OUT") {
           // Double-check that the session is truly gone before clearing data.
           // A race with token refresh can fire a spurious SIGNED_OUT.
           const { data: { session: currentSession } } = await supabase.auth.getSession();
           if (currentSession) {
             // Session is still valid — ignore this spurious SIGNED_OUT event
             console.log("[AuthProvider] Ignoring spurious SIGNED_OUT — session still active");
             setSession(currentSession);
             setUser(currentSession.user);
             return;
           }
           console.log("[AuthProvider] Clearing data on SIGNED_OUT");
           clearUserData();
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      cleanupNotifications();
    };
  }, []);

  const addLog = useCallback((msg: string) => {
    const safeMsg = String(msg || "");
    console.log("[AuthDebug]", safeMsg);
    setDebugLogs(prev => [safeMsg.slice(0, 100), ...prev].slice(0, 20));
  }, []);

  const fetchUserData = useCallback(async (userId: string, authUser?: User | null) => {
    if (!userId) return;
    
    try {
      addLog(`Fetch start UID: ${userId.slice(0, 8)}...`);
      console.log(`[AuthProvider] fetchUserData for ${userId}`);
      
      // 1. Fetch Profile
      const { data: profileData, error: profileError } = await supabase
        .from("members")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        console.warn("[AuthProvider] Profile fetch error:", profileError.message);
        addLog(`Profile Error: ${profileError.message}`);
      }

      if (profileData) {
        console.log("[AuthProvider] Profile found:", profileData.id);
        
        // If profile exists but gender is missing, and we have it in metadata, update it.
        // This handles cases where a DB trigger created the row without metadata.
        const metadataGender = (authUser?.user_metadata?.gender as string)?.toLowerCase() || null;
        if (!profileData.gender && metadataGender) {
          console.log("[AuthProvider] Gender missing in profile, updating from metadata:", metadataGender);
          const { data: updatedProfile } = await supabase
            .from("members")
            .update({ gender: metadataGender })
            .eq("id", userId)
            .select()
            .maybeSingle();
          
          if (updatedProfile) {
            setProfile(updatedProfile as MemberProfile);
          } else {
            setProfile(profileData as MemberProfile);
          }
        } else {
          setProfile(profileData as MemberProfile);
        }
        
        await loadLocalAddress(profileData as MemberProfile);
      } else {
        console.log("[AuthProvider] No profile found, auto-creating...");
        // Auto-create profile if missing
        const metadataGender = (authUser?.user_metadata?.gender as string)?.toLowerCase() || null;
        
        const { data: newProfile, error: createError } = await supabase
          .from("members")
          .insert({
            id: userId,
            email: authUser?.email || "",
            name: authUser?.user_metadata?.name || "C24 Member",
            gender: metadataGender,
            membership: 'Free',
            image_status: 'pending'
          })
          .select()
          .maybeSingle();

        if (createError) {
          console.error("[AuthProvider] Error creating profile:", createError.message);
          // If we fail to create (e.g. race condition), try one more select
          const { data: retryProfile } = await supabase
            .from("members")
            .select("*")
            .eq("id", userId)
            .maybeSingle();
          if (retryProfile) setProfile(retryProfile as MemberProfile);
        } else if (newProfile) {
          setProfile(newProfile as MemberProfile);
          await loadLocalAddress(newProfile as MemberProfile);
        }
      }
      
      // 2. Fetch Minutes (Source of truth: earn-minutes edge function)
      try {
        const { data: balanceData, error: balanceError } = await supabase.functions.invoke("earn-minutes", {
          body: { type: "get_balance", userId },
        });

        if (!balanceError && balanceData?.success) {
          console.log("[AuthProvider] Balance fetched from edge function:", balanceData);
          
          // Fetch the actual row to get other fields (vip status, etc.)
          const { data: minutesData } = await supabase
            .from("member_minutes")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();

          if (minutesData) {
            const transformedData = {
              ...minutesData,
              // If the API provides totalMinutes, it's the lifetime total.
              // The current spendable balance in DB is minutesData.minutes.
              lifetime_earned: balanceData.totalMinutes ?? minutesData.total_minutes ?? 0,
              minutes: balanceData.currentMinutes ?? balanceData.minutes ?? minutesData.minutes ?? 0,
              gifted_minutes: balanceData.giftedMinutes ?? minutesData.gifted_minutes ?? 0,
              // total_minutes is used in store/modals as the total spendable balance
              total_minutes: (balanceData.currentMinutes ?? balanceData.minutes ?? minutesData.minutes ?? 0) + 
                             (balanceData.giftedMinutes ?? minutesData.gifted_minutes ?? 0) + 
                             (minutesData.ad_points || 0),
              is_frozen: balanceData.isFrozen ?? minutesData.is_frozen ?? false,
            };
            setMinutes(transformedData as MemberMinutes);

            // Sync membership title
            if (transformedData.is_vip && transformedData.vip_tier) {
              const newMembership = transformedData.vip_tier.charAt(0).toUpperCase() + transformedData.vip_tier.slice(1);
              setProfile(prev => prev ? { ...prev, membership: newMembership } : null);
            } else if (!transformedData.is_vip) {
              setProfile(prev => prev ? { ...prev, membership: 'Free' } : null);
            }
          } else {
            // Create row if missing, using balance from edge function
            const { data: newMin } = await supabase
              .from("member_minutes")
              .insert({ 
                user_id: userId, 
                minutes: balanceData.totalMinutes,
                total_minutes: balanceData.totalMinutes,
                gifted_minutes: balanceData.giftedMinutes ?? 0,
                is_frozen: balanceData.isFrozen ?? false
              })
              .select()
              .maybeSingle();
            
            if (newMin) {
              setMinutes({
                ...newMin,
                lifetime_earned: balanceData.totalMinutes,
                total_minutes: (balanceData.totalMinutes || 0) + (balanceData.giftedMinutes ?? 0),
              } as MemberMinutes);
            }
          }
        } else {
          // Fallback to direct table query if edge function fails
          console.warn("[AuthProvider] Fallback to direct minutes fetch:", balanceError?.message);
          const { data: minutesData } = await supabase
            .from("member_minutes")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();

          if (minutesData) {
            const transformedData = {
              ...minutesData,
              lifetime_earned: minutesData.total_minutes ?? 0,
              total_minutes: (minutesData.minutes || 0) + (minutesData.ad_points || 0) + (minutesData.gifted_minutes || 0),
            };
            setMinutes(transformedData as MemberMinutes);
          } else {
            // Auto-create
            const { data: newMin } = await supabase
              .from("member_minutes")
              .insert({ user_id: userId, minutes: 0 })
              .select()
              .maybeSingle();
            if (newMin) {
              setMinutes({ ...newMin, total_minutes: 0, lifetime_earned: 0 } as MemberMinutes);
            }
          }
        }
      } catch (err) {
        console.error("[AuthProvider] Minutes fetch fatal error:", err);
      }

      // Fetch freeze settings
      const { data: settingsData } = await supabase
        .from("freeze_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      
      if (settingsData) {
        setFreezeSettings(settingsData as FreezeSettings);
      }

      // NEW: Trigger female search notification check for male users
      const gender = profileData?.gender || (authUser?.user_metadata?.gender as string);
      if (gender?.toLowerCase() === 'male') {
        supabase.functions.invoke("notify-searching-users", { body: {} }).catch(() => {});
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
    }
  }, []);

  const clearUserData = useCallback(() => {
    setProfile(null);
    setMinutes(null);
    setFreezeSettings(null);
  }, []);

  const updateMinutes = useCallback(async (updates: Partial<MemberMinutes>) => {
    if (!user?.id) return;
    try {
      // If updating total_minutes, map it to minutes for the DB
      const dbUpdates = { ...updates };
      if ('total_minutes' in dbUpdates) {
        (dbUpdates as any).minutes = dbUpdates.total_minutes;
      }
      
      const { data, error } = await supabase
        .from("member_minutes")
        .update(dbUpdates)
        .eq("user_id", user.id)
        .select()
        .maybeSingle();

      if (error) {
        console.error("[AuthContext] updateMinutes DB error:", error.message);
        throw error;
      }
      
      if (data) {
        const transformedData = {
          ...data,
          lifetime_earned: data.total_minutes ?? 0,
          total_minutes: (data.minutes || 0) + (data.ad_points || 0) + (data.gifted_minutes || 0),
        };
        setMinutes(transformedData as MemberMinutes);
      } else {
        // No data returned — update local state optimistically
        setMinutes(prev => prev ? {
          ...prev,
          ...updates,
          lifetime_earned: updates.total_minutes ?? prev.lifetime_earned ?? 0,
          total_minutes: (prev.minutes || 0) + (prev.ad_points || 0) + (prev.gifted_minutes || 0),
        } : prev);
      }
    } catch (err) {
      console.error("Error updating minutes:", err);
      throw err;
    }
  }, [user]);

  const updateMinutesFromRow = useCallback((row: any) => {
    if (!row) return;
    const transformedData = {
      ...row,
      lifetime_earned: row.total_minutes ?? 0,
      total_minutes: (row.minutes || 0) + (row.ad_points || 0) + (row.gifted_minutes || 0),
    };
    setMinutes(transformedData as MemberMinutes);
  }, []);

  const updateProfile = useCallback(async (updates: Partial<MemberProfile>, skipSync = false) => {
    if (!user?.id || !profile) return;
    try {
      console.log("[AuthContext] updateProfile start for user_id:", user.id, "updates:", updates);
      
      // 1. Handle local storage for shipping address fields that aren't in DB
      const shippingFields = [
        'shipping_name', 
        'shipping_address', 
        'shipping_city', 
        'shipping_state', 
        'shipping_zip', 
        'shipping_country'
      ];
      
      const localUpdates: any = {};
      const dbUpdates: any = { ...updates };
      
      shippingFields.forEach(field => {
        if (field in updates) {
          localUpdates[field] = (updates as any)[field];
          // Keep city/state/zip/country for DB if they exist there too
          const dbFieldName = field.replace('shipping_', '');
          const allowedDbFields = ['name', 'city', 'state', 'zip', 'country'];
          if (allowedDbFields.includes(dbFieldName)) {
            dbUpdates[dbFieldName] = (updates as any)[field];
          }
          // Remove the shipping_ prefixed fields from DB update to avoid errors
          delete (dbUpdates as any)[field];
        }
      });
      
      if (Object.keys(localUpdates).length > 0) {
        const existingLocal = await storage.getItem(`shipping_address_${profile.id}`);
        const parsedLocal = existingLocal ? JSON.parse(existingLocal) : {};
        const newLocal = { ...(parsedLocal && typeof parsedLocal === 'object' ? parsedLocal : {}), ...localUpdates };
        await storage.setItem(`shipping_address_${profile.id}`, JSON.stringify(newLocal));
        console.log("[AuthContext] Saved shipping address to local storage");
      }

      // 2. Perform DB update for remaining fields
      if (Object.keys(dbUpdates).length > 0) {
        let { data, error } = await supabase
          .from("members")
          .update(dbUpdates)
          .eq("id", user.id)
          .select()
          .maybeSingle();
        
        if (error) {
          console.warn("[AuthContext] updateProfile DB error:", error.message);
          throw error;
        }
        
        if (data && !skipSync) {
          console.log("[AuthContext] updateProfile success:", data.id);
          // Merge local updates back into profile state
          setProfile(prev => prev ? { ...prev, ...data, ...localUpdates } : null);
        }
      } else {
        // Just update local state if no DB changes
        setProfile(prev => prev ? { ...prev, ...localUpdates } : null);
      }
    } catch (err: any) {
      console.error("[AuthContext] Error updating profile:", err.message);
      throw err;
    }
  }, [user, profile]);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchUserData(user.id, user);
    }
  }, [user, fetchUserData]);

  const syncVipStatus = useCallback(async () => {
    if (!user?.id) return;
    try {
      // Use fetchUserData to get the latest from edge function and DB in one go
      await fetchUserData(user.id, user);
    } catch (err) {
      console.error("Error syncing VIP status:", err);
    }
  }, [user, fetchUserData]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      await supabase.auth.signOut({ scope: "local" });
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        minutes,
        freezeSettings,
        loading,
        debugLogs,
        signOut,
        refreshProfile,
        updateMinutes,
        updateProfile,
        syncVipStatus,
        updateMinutesFromRow,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}