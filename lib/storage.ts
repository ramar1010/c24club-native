/**
 * lib/storage.ts — SSR-safe AsyncStorage wrapper
 */

import { Platform } from 'react-native';

const isServer = Platform.OS === 'web' && typeof window === 'undefined';

const noopStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
  clear: async () => {},
  getAllKeys: async () => [],
  multiGet: async () => [],
  multiSet: async () => {},
  multiRemove: async () => {},
  multiMerge: async () => {},
};

// Use dynamic require to avoid early execution of AsyncStorage module on SSR
const getStorage = () => {
  if (isServer) return noopStorage;
  try {
    return require('@react-native-async-storage/async-storage').default;
  } catch (e) {
    console.warn('[Storage] AsyncStorage import failed, using noop', e);
    return noopStorage;
  }
};

export const storage = getStorage();
export default storage;