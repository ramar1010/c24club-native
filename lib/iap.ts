import { Platform } from 'react-native';

export const IAP_PRODUCTS = {
  UNBAN: Platform.OS === 'ios' ? 'unbanme' : 'c24_unban_10',
  GIFT_100_MINUTES: Platform.OS === 'ios' ? '100minutes' : 'c24_gift_100_minutes',
  GIFT_400_MINUTES: Platform.OS === 'ios' ? '400minutes' : 'c24_gift_400_minutes',
  GIFT_600_MINUTES: Platform.OS === 'ios' ? '600minutes' : 'c24_gift_600_minutes',
  GIFT_1000_MINUTES: Platform.OS === 'ios' ? '1000Minutes' : 'c24_gift_1000_minutes',
  MINUTE_UNFREEZE: Platform.OS === 'ios' ? 'unfreeze_minutes' : 'c24_minute_unfreeze',
};

export const UNBAN_PRODUCT_ID = IAP_PRODUCTS.UNBAN;

export const IAP_SUBSCRIPTIONS = {
  BASIC_VIP: Platform.select({
    ios: 'basicvip',
    android: 'c24_basic_vip',
    default: 'basicvip',
  }),
  PREMIUM_VIP: Platform.select({
    ios: 'premiumvip',
    android: 'c24_premium_vip',
    default: 'premiumvip',
  }),
};

export const MINUTE_BUNDLES = [
  { sku: IAP_PRODUCTS.GIFT_100_MINUTES, minutes: 100, price: '$1.99', label: '100 Minutes' },
  { sku: IAP_PRODUCTS.GIFT_400_MINUTES, minutes: 400, price: '$4.99', label: '400 Minutes' },
  { sku: IAP_PRODUCTS.GIFT_600_MINUTES, minutes: 600, price: '$7.99', label: '600 Minutes' },
  { sku: IAP_PRODUCTS.GIFT_1000_MINUTES, minutes: 1000, price: '$12.99', label: '1000 Minutes', bestValue: true },
];

export const VIP_PLANS = [
  { sku: 'c24_basic_vip', label: 'Basic VIP', price: '$2.49', period: 'week', color: '#FACC15' },
  { sku: 'c24_premium_vip', label: 'Premium VIP', price: '$9.99', period: 'month', color: '#EF4444' },
];