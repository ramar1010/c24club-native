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
  total_minutes: number; // For compatibility with existing components
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
        setProfile(prev => prev ? { ...prev, ...addr } : null);
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
        
        setSession(newSession);
        setUser(currentUser);

        if (currentUser && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED")) {
           console.log(`[AuthProvider] Fetching data for ${event}...`);
           setLoading(true); // Ensure loading is true when fetching data
           fetchUserData(currentUser.id, currentUser).finally(() => {
             if (isMounted) setLoading(false);
           });
        } else if (event === "SIGNED_OUT") {
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
    console.log("[AuthDebug]", msg);
    setDebugLogs(prev => [msg.slice(0, 100), ...prev].slice(0, 20));
  }, []);

  const fetchUserData = useCallback(async (userId: string, authUser?: User | null) => {
    try {
      addLog(`Fetch start UID: ${userId.slice(0, 8)}...`);
      console.log(`[AuthProvider] fetchUserData for ${userId}`);
      
      // Lovable typically uses 'members' table
      const { data: profileData, error: profileError } = await supabase
        .from("members")
        .select("*")
        .eq("id", userId) // Fixed from user_id to id
        .maybeSingle();

      if (profileError) {
        console.warn("[AuthProvider] Profile fetch error:", profileError.message);
        addLog(`Profile Error: ${profileError.message}`);
      }

      if (profileData) {
        addLog(`Profile OK: ${profileData.name || profileData.email}`);
        console.log("[AuthProvider] Profile found:", profileData.id);
        setProfile(profileData as MemberProfile);
        await loadLocalAddress(profileData as MemberProfile);

        // Deleted: Register push token
        // try {
        //   const token = await registerForPushNotifications();
        //   if (token && token !== (profileData as any).push_token) {
        //     await supabase.from('members').update({ push_token: token }).eq('id', userId);
        //     setProfile(prev => prev ? { ...prev, push_token: token } : null);
        //   }
        // } catch (_) {}

      } else {
        addLog("No profile found.");
        console.warn("[AuthProvider] No profile row found for user:", userId, "Creating one...");
        
        // Auto-create profile if missing
        const metadataGender = (authUser?.user_metadata?.gender as string)?.toLowerCase() || null;
        console.log("[AuthProvider] Auto-creating profile with gender:", metadataGender);
        
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
        } else if (newProfile) {
          console.log("[AuthProvider] Profile created successfully. Gender:", newProfile.gender);
          setProfile(newProfile as MemberProfile);
          await loadLocalAddress(newProfile as MemberProfile);
        }
      }
      
      // Fetch minutes - Lovable uses 'member_minutes'
      const { data: minutesData, error: minError } = await supabase
        .from("member_minutes")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (minError) {
        console.warn("[AuthProvider] Minutes fetch error:", minError.message);
        addLog(`Minutes Error: ${minError.message}`);
      }

      if (minutesData) {
        addLog("Minutes OK");
        console.log("[AuthProvider] Minutes found for user:", userId);
        const transformedData = {
          ...minutesData,
          total_minutes: (minutesData.minutes || 0) + (minutesData.ad_points || 0) + (minutesData.gifted_minutes || 0),
        };
        setMinutes(transformedData as MemberMinutes);
      } else {
        addLog("Creating minutes row...");
        console.log("[AuthProvider] Creating missing minutes row for user:", userId);
        const { data: newMin } = await supabase
          .from("member_minutes")
          .insert({ user_id: userId, minutes: 0 })
          .select()
          .maybeSingle();
        
        if (newMin) {
          addLog("Minutes created OK");
          const transformedData = {
            ...newMin,
            total_minutes: (newMin.minutes || 0) + (newMin.ad_points || 0) + (newMin.gifted_minutes || 0),
          };
          setMinutes(transformedData as MemberMinutes);
        }
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
          total_minutes: (data.minutes || 0) + (data.ad_points || 0) + (data.gifted_minutes || 0),
        };
        setMinutes(transformedData as MemberMinutes);
      } else {
        // No data returned — update local state optimistically
        setMinutes(prev => prev ? {
          ...prev,
          ...updates,
          total_minutes: (prev.minutes || 0) + (prev.ad_points || 0) + (prev.gifted_minutes || 0),
        } : prev);
      }
    } catch (err) {
      console.error("Error updating minutes:", err);
      throw err;
    }
  }, [user]);

  const updateProfile = useCallback(async (updates: Partial<MemberProfile>) => {
    if (!user?.id || !profile?.id) return;
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
        const newLocal = { ...(existingLocal ? JSON.parse(existingLocal) : {}), ...localUpdates };
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
        
        if (data) {
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
      const { data: updatedMinutes, error: updateError } = await supabase
        .from('member_minutes')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (updateError) throw updateError;
      if (updatedMinutes) setMinutes(updatedMinutes as MemberMinutes);
    } catch (err) {
      console.error("Error syncing VIP status:", err);
    }
  }, [user]);

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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}