export const IAP_PRODUCTS = {
  UNBAN: 'c24_unban_10',
  GIFT_100_MINUTES: 'c24_gift_100_minutes',
  GIFT_400_MINUTES: 'c24_gift_400_minutes',
  GIFT_600_MINUTES: 'c24_gift_600_minutes',
  GIFT_1000_MINUTES: 'c24_gift_1000_minutes',
  MINUTE_UNFREEZE: 'c24_minute_unfreeze',
};

export const IAP_SUBSCRIPTIONS = {
  BASIC_VIP: 'c24_basic_vip',
  PREMIUM_VIP: 'c24_premium_vip',
};

export const MINUTE_BUNDLES = [
  { sku: 'c24_gift_100_minutes', minutes: 100, price: '$1.99', label: '100 Minutes' },
  { sku: 'c24_gift_400_minutes', minutes: 400, price: '$4.99', label: '400 Minutes' },
  { sku: 'c24_gift_600_minutes', minutes: 600, price: '$7.99', label: '600 Minutes' },
  { sku: 'c24_gift_1000_minutes', minutes: 1000, price: '$12.99', label: '1000 Minutes', bestValue: true },
];

export const VIP_PLANS = [
  { sku: 'c24_basic_vip', label: 'Basic VIP', price: '$2.49', period: 'week', color: '#FACC15' },
  { sku: 'c24_premium_vip', label: 'Premium VIP', price: '$9.99', period: 'month', color: '#EF4444' },
];