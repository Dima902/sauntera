// utils/filterHelpers.js

import { filterLogic } from './filterMap';

export const getActivityListForCombinedFilters = (filters = []) => {
  const dummyIdea = (activity) => ({ activity });

  const matchingActivities = new Set();

  const knownActivities = [
    // add all known activity keys here or dynamically map from all filters
    'coffeeshop', 'arcade', 'market', 'picnic', 'parkwalk', 'boardgames',
    'dinner', 'rooftop', 'liveconcert', 'winetasting', 'spa', 'poetryreading',
    'vr', 'escaperoom', 'bowling', 'foodtruck', 'livejazz', 'museum',
    'artgallery', 'bookstore', 'historicwalk', 'comedyshow', 'theater',
    'basketball', 'rockclimbing', 'gym', 'hiking', 'biking',
    'tennis', 'iceskating', 'hotchocolate', 'teatime', 'yoga', 'artclass',
    'potteryclass', 'recordshopping', 'cinema', 'indoorpicnic', 'ferryride',
    'helicopterride', 'communityevent', 'streetart', 'openaircinema'
  ];

  for (const activity of knownActivities) {
    const idea = dummyIdea(activity);
    if (filters.some(f => filterLogic[f]?.(idea))) {
      matchingActivities.add(activity);
    }
  }

  return Array.from(matchingActivities);
};
