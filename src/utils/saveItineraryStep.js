// saveItineraryStep.js - refactored 24-Apr-2025. 10.21pm
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig';

/**
 * Saves a step to the user's savedSteps collection in Firestore.
 * @param {object} step - The step object to save (should include at least an id or will be generated)
 * @param {object} [userOverride] - Optional: pass a user object (for admin/impersonation)
 * @returns {Promise<boolean>} - true if saved, false if not
 */
export const saveStepToFirebase = async (step, userOverride = null) => {
  try {
    const user = userOverride || auth.currentUser;
    if (!user) {
      console.warn('saveStepToFirebase: No authenticated user.');
      return false;
    }

    // Prefer step.id, otherwise generate a unique ID
    let stepId = step.id;
    if (!stepId) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        stepId = crypto.randomUUID();
      } else {
        stepId = `${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
      }
    }

    const stepRef = doc(db, `users/${user.uid}/savedSteps`, stepId);
    await setDoc(stepRef, { ...step, id: stepId }, { merge: true });
    // Optionally: console.log(`✅ Saved itinerary step for user ${user.uid}: ${stepId}`);
    return true;
  } catch (err) {
    console.error('❌ Error saving itinerary step:', err);
    return false;
  }
};