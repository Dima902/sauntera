// filtersConfig.js – Updated with bidirectional conflict support

export const CONFLICT_MAP = {
  'First Date': ['Anniversary'],
  'Anniversary': ['First Date'],
  'Outdoor Adventure': ['Indoor Activities', 'Jazz Night', 'Bars'],
  'Indoor Activities': ['Outdoor Adventure'],
  'Relaxed & Chill': ['Exciting & Thrilling', 'Fun & Playful', 'Active & Sporty', 'Bars'],
  'Exciting & Thrilling': ['Relaxed & Chill'],
  'Active & Sporty': [
    'Relaxation & Spa',
    'Jazz Night',
    'Creative & Artsy',
    'Relaxed & Chill',
    'Cultural Experience',
    'Live Entertainment',
    'Bars'
  ],
  'Relaxation & Spa': [
    'Fun & Playful',
    'Creative & Artsy',
    'Active & Sporty',
    'Cultural Experience',
    'Live Entertainment',
    'Outdoor Adventure',
    'Unique & Unusual Dates',
    'Exciting & Thrilling',
    'Bars'
  ],
  'Jazz Night': ['Active & Sporty', 'Relaxation & Spa', 'Creative & Artsy', 'Outdoor Adventure'],
  'Creative & Artsy': [
    'Active & Sporty',
    'Fun & Playful',
    'Live Entertainment',
    'Romantic Dinner',
    'Bars'
  ],
  'Cultural Experience': [
    'Active & Sporty',
    'Fun & Playful',
    'Live Entertainment',
    'Romantic Dinner',
    'Bars'
  ],
  'Live Entertainment': [
    'Relaxation & Spa',
    'Creative & Artsy',
    'Active & Sporty',
    'Cultural Experience',
    'Romantic Dinner'
  ],
  'Fun & Playful': [
    'Romantic Dinner',
    'Relaxation & Spa',
    'Relaxed & Chill',
    'Creative & Artsy',
    'Cultural Experience'
  ],
  'Romantic Dinner': [
    'Fun & Playful',
    'Creative & Artsy',
    'Active & Sporty',
    'Relaxation & Spa',
    'Cultural Experience',
    'Live Entertainment',
    'Outdoor Adventure',
    'Unique & Unusual Dates',
    'Relaxed & Chill',
    'Exciting & Thrilling'
  ],
};

export const isMutuallyConflicting = (f1, f2) =>
  (CONFLICT_MAP[f1]?.includes(f2) || CONFLICT_MAP[f2]?.includes(f1));

export const getConflicts = (selected, existing) =>
  (CONFLICT_MAP[selected] || []).filter((conflict) => existing.includes(conflict));

export const quickFilters = [
  'First Date',
  'Anniversary',
  'Fun & Playful',
  'Romantic Dinner',
  'Outdoor Adventure',
  'Cultural Experience',
  'Budget-Friendly',
  'Indoor Activities',
  'Bars'
];

export const advancedFilters = [
  'Live Entertainment',
  'Active & Sporty',
  'Jazz Night',
  'Relaxation & Spa',
  'Creative & Artsy',
  'Relaxed & Chill',
  'Exciting & Thrilling',
  'Unique & Unusual Dates',
];

export const MAX_GUEST_USES = 2;
export const MAX_SIMULTANEOUS_FILTERS = 3;
