// utils/purchasesUtils.js

import * as RNIap from 'react-native-iap';
import { PRODUCTS } from '../constants/Products';

export const getActivePurchases = async () => {
  try {
    const availablePurchases = await RNIap.getAvailablePurchases();

    const ownedProductIds = availablePurchases.map((purchase) => purchase.productId);

    console.log('🛒 Google Play active purchases:', ownedProductIds);

    return ownedProductIds; // e.g. ['premium_monthly']
  } catch (error) {
    console.error('❌ Failed to fetch purchases from Google Play:', error);
    return [];
  }
};
