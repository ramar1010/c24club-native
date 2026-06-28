/**
 * lib/iap-import.web.ts
 *
 * Web stubs for IAP. Web doesn't support native IAP.
 */

export type Subscription = any;
export type Product = any;
export type Purchase = any;
export type PurchaseError = any;

export const initConnection = async () => false;
export const getSubscriptions = async () => [];
export const getProducts = async () => [];
export const requestSubscription = async () => { throw new Error('IAP not supported on web'); };
export const requestPurchase = async () => { throw new Error('IAP not supported on web'); };
export const purchaseUpdatedListener = () => ({ remove: () => {} });
export const purchaseErrorListener = () => ({ remove: () => {} });
export const finishTransaction = async () => {};
export const getAvailablePurchases = async () => [];
export const getPendingTransactionsIOS = async () => [];
export const clearTransactionIOS = async () => {};