// analytics/trackFilterEvent.js
import { getAuthInstance, db } from '../config/firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';

export const trackFilterEvent = async (type, filters, location) => {
  const auth = await getAuthInstance();
  const userId = auth?.currentUser?.uid || 'guest';
  const eventRef = collection(db, 'filterAnalytics');

  try {
    await addDoc(eventRef, {
      userId,
      type, // "apply" | "reset" | "select"
      filters,
      location,
      timestamp: new Date(),
    });
    console.log(`📊 Logged filter event: ${type}`, filters);
  } catch (e) {
    console.warn('⚠️ Failed to log filter event:', e.message);
  }
};
