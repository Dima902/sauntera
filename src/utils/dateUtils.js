// utils/dateUtils.js

export const getTodayDateString = () => {
  const now = new Date();
  return now.toISOString().split('T')[0]; // "2025-06-21"
};
