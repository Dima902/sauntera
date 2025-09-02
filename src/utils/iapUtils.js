// src/utils/iapUtils.js
import * as RNIap from 'react-native-iap';

export async function withIapPurchase({ sku, uid, onProcessing, onDone, onError }) {
  try {
    await RNIap.initConnection();
    // Clear stale pending purchases
    await RNIap.flushFailedPurchasesCachedAsPendingAndroid();

    // Start listeners
    const updateSub = RNIap.purchaseUpdatedListener(async (purchase) => {
      try {
        const { purchaseToken, productId } = purchase;
        onProcessing?.(); // e.g. show "Processing purchase..." banner

        // Verify with your Firebase Function
        await fetch('https://<your-cloud-function-url>/verifyPlaySub', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ purchaseToken, productId, uid }),
        });

        // Always acknowledge the subscription
        await RNIap.finishTransaction({ purchase, isConsumable: false });

        // Don’t flip UI here — wait for Firestore listener in useUserStatus
        onDone?.();
      } catch (err) {
        console.error('[withIapPurchase] verification failed:', err);
        onError?.(err);
      }
    });

    const errorSub = RNIap.purchaseErrorListener((err) => {
      console.warn('[withIapPurchase] purchase error:', err);
      onError?.(err);
    });

    // Trigger purchase flow
    await RNIap.requestSubscription({ sku });

    // Return cleanup
    return () => {
      updateSub.remove();
      errorSub.remove();
    };
  } catch (err) {
    console.error('[withIapPurchase] init failed:', err);
    onError?.(err);
  }
}
