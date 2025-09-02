// src/constants/Products.ts
// Define all product IDs in one place.
// ⚠️ IMPORTANT: These must match exactly the IDs you created in Google Play Console
// under Monetize → Products → Subscriptions / In-app products.

export const PRODUCTS = {
  // Subscription SKU (recurring). Example: monthly premium plan
  SUBSCRIPTION: 'sauntera_premium',

  // One-time purchase SKU (non-consumable).
  // Only include this if you actually created it in Play Console.
  LIFETIME: 'sauntera_lifetime',
};
