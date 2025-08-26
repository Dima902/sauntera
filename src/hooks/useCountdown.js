import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPIRATION_KEY = 'subscriptionCountdownEnd';
const DURATION_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

const useCountdown = () => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    expired: false,
  });

  const getTimeRemaining = (endTime) => {
    const now = new Date().getTime();
    const distance = endTime - now;

    if (distance <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds, expired: false };
  };

  useEffect(() => {
    let interval;
    const initializeCountdown = async () => {
      try {
        let endTime = await AsyncStorage.getItem(EXPIRATION_KEY);
        const now = new Date().getTime();

        if (!endTime || parseInt(endTime, 10) < now) {
          const newEndTime = now + DURATION_MS;
          await AsyncStorage.setItem(EXPIRATION_KEY, newEndTime.toString());
          endTime = newEndTime;
        } else {
          endTime = parseInt(endTime, 10);
        }

        setTimeLeft(getTimeRemaining(endTime));

        interval = setInterval(() => {
          const remaining = getTimeRemaining(endTime);
          if (remaining.expired) {
            const newEndTime = new Date().getTime() + DURATION_MS;
            AsyncStorage.setItem(EXPIRATION_KEY, newEndTime.toString());
            setTimeLeft(getTimeRemaining(newEndTime));
          } else {
            setTimeLeft(remaining);
          }
        }, 1000); // every second for live countdown
      } catch (error) {
        console.error('Countdown error:', error);
      }
    };

    initializeCountdown();
    return () => clearInterval(interval);
  }, []);

  return timeLeft;
};

export default useCountdown;
