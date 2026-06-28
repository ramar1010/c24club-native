import * as Crypto from 'expo-crypto';

/**
 * Generates a cryptographically random nonce and returns both
 * the raw value (for Supabase) and the SHA-256 hashed value (for Google).
 *
 * Google Sign-In embeds the hashed nonce in the ID token.
 * Supabase verifies it by hashing the raw nonce and comparing — so both must match.
 */
export async function generateNonce(): Promise<{ rawNonce: string; hashedNonce: string }> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce
  );
  return { rawNonce, hashedNonce };
}