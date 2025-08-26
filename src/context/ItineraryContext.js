// ItineraryContext.js - Updated for safe dynamic auth usage
import React, { createContext, useEffect, useState } from 'react';
import { getAuthInstance, db } from '../config/firebaseConfig';
import { doc, deleteDoc, setDoc } from 'firebase/firestore';
import uuid from 'react-native-uuid';
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

export const ItineraryContext = createContext();

export const ItineraryProvider = ({ children }) => {
  const [itinerary, setItinerary] = useState([]);
  const [authRef, setAuthRef] = useState(null);

  useEffect(() => {
    (async () => {
      const auth = await getAuthInstance();
      setAuthRef(auth);
    })();
  }, []);

  const addToItinerary = async (step) => {
    if (!step?.id) {
      step.id = uuid.v4();
    }

    setItinerary((prev) => [...prev, step]);

    const user = authRef?.currentUser;
    if (!user) {
      console.warn('⚠️ No user signed in. Skipping Firestore write.');
      return;
    }

    const ref = doc(db, `users/${user.uid}/savedSteps`, step.id.toString());
    console.log('📌 Writing step to Firestore at:', ref.path);

    try {
      await setDoc(ref, step, { merge: true });
      console.log('✅ Step saved to Firestore:', step);
    } catch (err) {
      console.error('❌ Failed to save step to Firestore:', err);
    }
  };

  const removeFromItinerary = async (stepId) => {
    setItinerary((prev) => prev.filter((step) => step.id !== stepId));

    const user = authRef?.currentUser;
    if (!user) return;

    try {
      const stepRef = doc(db, `users/${user.uid}/savedSteps`, stepId.toString());
      await deleteDoc(stepRef);
    } catch (error) {
      console.warn('❌ Failed to delete step from Firestore:', error);
    }
  };

  const clearItinerary = () => {
    setItinerary([]);
  };

  const updateItineraryOrder = async (steps) => {
    setItinerary(steps);

    const user = authRef?.currentUser;
    if (!user) return;

    try {
      for (const step of steps) {
        const ref = doc(db, `users/${user.uid}/savedSteps`, step.id.toString());
        await setDoc(ref, step, { merge: true });
      }
    } catch (error) {
      console.warn('❌ Failed to save reordered steps to Firestore:', error);
    }
  };

  const markStepCompleted = async (step) => {
    const user = authRef?.currentUser;
    if (!user) return;

    await removeFromItinerary(step.id);

    try {
      const historyRef = doc(db, `users/${user.uid}/history`, step.id.toString());
      await setDoc(historyRef, {
        ...step,
        completedAt: new Date(),
      });

      await syncWithCalendar(step);
    } catch (error) {
      console.warn('❌ Failed to add step to history or calendar:', error);
    }
  };

  const syncWithCalendar = async (step) => {
    try {
      const { title, time } = step;
      const date = new Date();
      const [hh, mm] = time?.split(':') || ['18', '00'];
      date.setHours(parseInt(hh));
      date.setMinutes(parseInt(mm));
      date.setSeconds(0);

      const end = new Date(date);
      end.setHours(end.getHours() + 2);

      const calendarId = await getOrCreateCalendar();
      if (!calendarId) return;

      await Calendar.createEventAsync(calendarId, {
        title: `Completed: ${title}`,
        startDate: date,
        endDate: end,
        timeZone: 'local',
        notes: 'Logged from Sauntera app',
      });
    } catch (err) {
      console.warn('📅 Calendar sync failed:', err);
    }
  };

  const getOrCreateCalendar = async () => {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') return null;

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const writable = calendars.find(cal => cal.allowsModifications);
    if (writable) return writable.id;

    const defaultSource =
      Platform.OS === 'ios'
        ? await Calendar.getDefaultCalendarAsync()
        : { isLocalAccount: true, name: 'Sauntera' };

    return await Calendar.createCalendarAsync({
      title: 'Sauntera Events',
      color: '#FF9500',
      entityType: Calendar.EntityTypes.EVENT,
      source: defaultSource,
      sourceId: defaultSource.id,
      name: 'Sauntera',
      ownerAccount: 'Sauntera',
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });
  };

  return (
    <ItineraryContext.Provider
      value={{
        itinerary,
        addToItinerary,
        removeFromItinerary,
        clearItinerary,
        setItinerary,
        updateItineraryOrder,
        markStepCompleted,
      }}
    >
      {children}
    </ItineraryContext.Provider>
  );
};
