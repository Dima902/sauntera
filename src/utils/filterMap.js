// filterMap.js – Filter logic for each filter name (used in FiltersScreen + DeckLoader)
// NOTE: This file is the client/UI truth for filter semantics.
// Server-side predicates are built in filterPredicates.js to MATCH these tokens exactly.

import { CONFLICT_MAP } from './filtersConfig';

// --- helpers ---------------------------------------------------------------
const activityOf = (idea) => String(idea?.activity || '').toLowerCase();
const categoryOf = (idea) => String(idea?.category || '').toLowerCase();
const priceOf    = (idea) => String(idea?.price || '').trim(); // e.g., 'Free', '$', '$$'

// Predeclare sets so membership checks are fast & consistent
const SET = {
  firstDate: new Set(['arcade', 'market', 'picnic', 'parkwalk', 'boardgames']),
  anniversary: new Set(['liveconcert', 'winetasting', 'spa', 'poetryreading']),
  funPlayful: new Set(['arcade', 'boardgames', 'vr', 'escaperoom', 'bowling', 'foodtruck']),
  romanticDinner: new Set(['dinner', 'rooftop', 'teatime', 'coffeeshop']),
  culturalExperience: new Set(['museum', 'artgallery', 'bookstore', 'poetryreading', 'historicwalk']),
  bars: new Set(['bar']),
  liveEntertainment: new Set(['liveconcert', 'livejazz', 'comedyshow', 'theater']),
  activeSporty: new Set(['basketball', 'rockclimbing', 'gym', 'hiking', 'biking', 'tennis', 'iceskating']),
  relaxationSpa: new Set(['spa', 'hotchocolate', 'yoga']),
  creativeArtsy: new Set(['artclass', 'potteryclass', 'museum', 'artgallery', 'recordshopping']),
  relaxedChill: new Set(['cinema', 'spa', 'indoorpicnic', 'teatime', 'bookstore']),
  excitingThrilling: new Set(['escaperoom', 'helicopterride', 'vr']),
  uniqueUnusual: new Set(['ferryride', 'helicopterride', 'communityevent', 'streetart', 'openaircinema']),
};

export const filterLogic = {
  // QUICK FILTERS
  'First Date': (idea) => SET.firstDate.has(activityOf(idea)),
  'Anniversary': (idea) => SET.anniversary.has(activityOf(idea)),
  'Fun & Playful': (idea) => SET.funPlayful.has(activityOf(idea)),
  'Romantic Dinner': (idea) => SET.romanticDinner.has(activityOf(idea)),
  'Outdoor Adventure': (idea) => categoryOf(idea) === 'out',
  'Cultural Experience': (idea) => SET.culturalExperience.has(activityOf(idea)),
  'Bars': (idea) => SET.bars.has(activityOf(idea)),
  'Budget-Friendly': (idea) => {
    const p = priceOf(idea);
    return p === '$' || p === '$$' || p.toLowerCase() === 'free';
  },
  'Indoor Activities': (idea) => categoryOf(idea) === 'ind',

  // ADVANCED FILTERS (Premium)
  'Live Entertainment': (idea) => SET.liveEntertainment.has(activityOf(idea)),
  'Active & Sporty': (idea) => SET.activeSporty.has(activityOf(idea)),
  // Only true live jazz venues pass — but handled like any other filter
  'Jazz Night': (idea) => activityOf(idea) === 'livejazz',
  'Relaxation & Spa': (idea) => SET.relaxationSpa.has(activityOf(idea)),
  'Creative & Artsy': (idea) => SET.creativeArtsy.has(activityOf(idea)),
  'Relaxed & Chill': (idea) => SET.relaxedChill.has(activityOf(idea)),
  'Exciting & Thrilling': (idea) => SET.excitingThrilling.has(activityOf(idea)),
  'Unique & Unusual Dates': (idea) => SET.uniqueUnusual.has(activityOf(idea)),
};

// Higher means stronger and preferred if we must pick one “primary” predicate.
export const filterPriority = {
  'Jazz Night': 100,
  'Bars': 95,
  'Romantic Dinner': 90,
  'Live Entertainment': 80,
  'Active & Sporty': 60,
  'Cultural Experience': 55,
  'Creative & Artsy': 50,
  'Fun & Playful': 40,
  'Unique & Unusual Dates': 30,
  'First Date': 20,
  'Relaxed & Chill': 15,
  'Relaxation & Spa': 10,
  'Anniversary': 5,
  'Budget-Friendly': 0,
  'Indoor Activities': 0,
  'Outdoor Adventure': 0,
};

// These can be layered with other non-layerables
const LAYERABLE = ['Budget-Friendly', 'Indoor Activities', 'Outdoor Adventure'];

// ▼ Reduced by priority (no sticky filters)
export const reduceFiltersByPriority = (filters = {}) => {
  const quick = Array.isArray(filters['Quick Filters']) ? filters['Quick Filters'] : [];
  const advanced = Array.isArray(filters['Advanced Filters']) ? filters['Advanced Filters'] : [];
  const all = [...quick, ...advanced];

  if (all.length === 0) {
    return { 'Quick Filters': [], 'Advanced Filters': [] };
  }

  // Find the single highest-priority non-layerable
  let highest = null;
  let maxScore = -Infinity;
  for (const f of all) {
    if (!LAYERABLE.includes(f)) {
      const score = filterPriority[f] ?? 0;
      if (score > maxScore) {
        maxScore = score;
        highest = f;
      }
    }
  }

  const keepSet = new Set();

  // Keep the computed highest (if any)
  if (highest) keepSet.add(highest);

  // Always allow layerable filters to stack with the chosen set
  for (const f of all) {
    if (LAYERABLE.includes(f)) keepSet.add(f);
  }

  // Remove conflicts VS highest
  if (highest) {
    const conflicts = CONFLICT_MAP?.[highest] || [];
    for (const f of Array.from(keepSet)) {
      if (f !== highest && !LAYERABLE.includes(f) && conflicts.includes(f)) {
        keepSet.delete(f);
      }
    }
  }

  // Rebuild Quick/Advanced buckets preserving original order
  const reduced = { 'Quick Filters': [], 'Advanced Filters': [] };
  for (const f of all) {
    if (keepSet.has(f)) {
      if (quick.includes(f)) reduced['Quick Filters'].push(f);
      else if (advanced.includes(f)) reduced['Advanced Filters'].push(f);
    }
  }

  return reduced;
};

export const passesAllFilters = (idea, filters = {}) => {
  const allSelected = [
    ...(filters['Quick Filters'] || []),
    ...(filters['Advanced Filters'] || []),
  ];

  return allSelected.every((filterName) => {
    const logicFn = filterLogic[filterName];
    return typeof logicFn === 'function' ? logicFn(idea) : true;
  });
};
