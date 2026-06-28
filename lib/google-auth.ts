import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from './supabase';
import { generateNonce } from './auth-utils';
import { Platform } from 'react-native';

/**
 * Handles Google Sign-In for both Native and Web.
 * 
 * Native: Uses @react-native-google-signin/google-signin with Supabase signInWithIdToken.
 * Web: Uses Supabase signInWithOAuth.
 */
export const signInWithGoogle = async () => {
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });
    if (error) throw error;
    return;
  }

  try {
    // Native implementation
    GoogleSignin.configure({
      webClientId: '212900711433-rild80si8g6sg8q5j7jl8goo6o9ecnqi.apps.googleusercontent.com',
      offlineAccess: true,
    });

    await GoogleSignin.hasPlayServices();
    
    // Use the "Quick Fix" approach: omit nonces to ensure matching
    const userInfo = await GoogleSignin.signIn();
    const idToken = userInfo.data?.idToken || (userInfo as any).idToken;

    if (!idToken) {
      throw new Error('Google Sign-In failed — no ID token.');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) throw error;
    return data;
  } catch (error: any) {
    // Sign in was cancelled by user
    if (error.code === '7' || error.message?.includes('cancelled')) {
      return null;
    }
    throw error;
  }
};