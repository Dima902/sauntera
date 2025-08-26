export const sparseQuerySet = new Set([
  'jazz bars',
  'live jazz',
  'treetop',
  'ferry ride',
  'ferry terminal',
  'historic places',
  'graffiti alley',
  'street art',
  'distillery district',
  'bouldering',
  'helicopterride',
  'horseback riding',
  'sunsetviewing',
  'stargazing',
]);

export function normalizeQuery(query = '') {
  return query.toLowerCase().trim();
}
