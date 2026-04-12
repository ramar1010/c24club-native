// Safe IAP import wrapper — returns no-ops on web to avoid native module crash in preview
import { Platform } from 'react-native';

let iap: any = null;

if (Platform.OS !== 'web') {
  try {
    iap = require('react-native-iap');
  } catch (e) {
    console.warn('[IAP] react-native-iap native module not available (Expo Go / web preview). IAP features disabled.');
  }
}

export const initConnection = (...args: any[]) => iap?.initConnection?.(...args) ?? Promise.resolve();
export const endConnection = (...args: any[]) => iap?.endConnection?.(...args) ?? Promise.resolve();
export const getProducts = (...args: any[]) => iap?.fetchProducts?.(...args) ?? Promise.resolve([]);
// v14: getSubscriptions replaced by fetchProducts with type: 'subs'
export const getSubscriptions = ({ skus }: { skus: string[] }) =>
  iap?.fetchProducts?.({ skus, type: 'subs' }) ?? Promise.resolve([]);
export const requestPurchase = (...args: any[]) => iap?.requestPurchase?.(...args) ?? Promise.resolve();
// v14: requestSubscription replaced by requestPurchase
export const requestSubscription = (...args: any[]) => iap?.requestPurchase?.(...args) ?? Promise.resolve();
export const finishTransaction = (...args: any[]) => iap?.finishTransaction?.(...args) ?? Promise.resolve();
export const purchaseUpdatedListener = (cb: any) => iap?.purchaseUpdatedListener?.(cb) ?? { remove: () => {} };
export const purchaseErrorListener = (cb: any) => iap?.purchaseErrorListener?.(cb) ?? { remove: () => {} };