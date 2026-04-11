import "react-native-url-polyfill/auto";
import { storage } from "@/lib/storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

// Always use the original C24 Club Supabase instance
const supabaseUrl = "https://ncpbiymnafxdfsvpxirb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA";

// On web, navigator.locks causes "lock stolen" errors when multiple tabs or
// hot-reloads race. Bypass it with a simple passthrough so auth works cleanly.
const webLock = Platform.OS === 'web'
  ? async (_name: string, _timeout: number, fn: () => Promise<any>) => fn()
  : undefined;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: storage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
    ...(webLock ? { lock: webLock } : {}),
  },
});