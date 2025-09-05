// src/utils/saveItineraryStep.js — Use getAuthInstance() correctly + return boolean
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuthInstance, db } from '../config/firebaseConfig';

/**
 * Saves a step to the user's savedSteps collection in Firestore.
 * @param {object} step - The step object to save (should include at least an id or will be generated)
 * @param {object} [userOverride] - Optional: pass a user object (for admin/impersonation)
 * @returns {Promise<boolean>} - true if saved, false if not
 */
export const saveStepToFirebase = async (step, userOverride = null) => {
  try {
    const auth = await getAuthInstance();
    const user = userOverride || auth?.currentUser;
    if (!user) {
      console.warn('saveStepToFirebase: No authenticated user.');
      return false;
    }

    let stepId = step.id;
    if (!stepId) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        stepId = crypto.randomUUID();
      } else {
        stepId = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
      }
    }

    const stepRef = doc(db, `users/${user.uid}/savedSteps`, stepId);
    await setDoc(
      stepRef,
      {
        ...step,
        id: stepId,
        createdAt: step.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.error('❌ Error saving itinerary step:', err);
    return false;
  }
};
