import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Custom hook to send a 'last_active_at' heartbeat to the backend.
 * Mirroring the web app's behavior: sends a heartbeat every 5 minutes while in the foreground.
 */
export function useHeartbeat() {
  const { user } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHeartbeatRef = useRef<number>(0);

  const sendHeartbeat = async () => {
    if (!user?.id) return;
    
    const now = Date.now();
    // Throttle heartbeats to once every 2 minutes minimum, even if manually triggered
    if (now - lastHeartbeatRef.current < 120000) return;

    try {
      console.log("[useHeartbeat] Sending heartbeat for:", user.id);
      const { error } = await supabase
        .from("members")
        .update({ last_active_at: new Date().toISOString() })
        .eq("id", user.id);
      
      if (error) throw error;
      lastHeartbeatRef.current = now;
    } catch (err) {
      console.warn("[useHeartbeat] Error sending heartbeat:", err);
    }
  };

  useEffect(() => {
    if (!user?.id) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial heartbeat on mount
    sendHeartbeat();

    // Set up 5-minute interval (300,000 ms)
    intervalRef.current = setInterval(sendHeartbeat, 300000);

    // Listen for app state changes (send heartbeat when coming to foreground)
    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        sendHeartbeat();
      }
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      subscription.remove();
    };
  }, [user?.id]);
}