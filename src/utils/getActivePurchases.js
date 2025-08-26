import Purchases from 'react-native-purchases';
import { PRODUCTS } from '../constants/Products';

// ✅ Mocked RevenueCat logic for active entitlements
export const getActivePurchases = async () => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();

    const entitlements = customerInfo?.entitlements?.active || {};

    const activeProductIds = Object.values(entitlements).map(
      (entitlement) => entitlement.productIdentifier
    );

    // ✅ Debug output
    console.log('🧾 RevenueCat active purchases:', activeProductIds);

    return activeProductIds; // e.g. ['premium_monthly']
  } catch (error) {
    console.error('❌ Failed to fetch purchases from RevenueCat:', error);
    return [];
  }
};
