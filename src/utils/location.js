/**
 * Reverse geocodes {lat, lng} to a formatted location name.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string|null>} e.g. "North York, Ontario, Canada"
 */
export const fetchLocationNameFromCoords = async (lat, lng) => {
  try {
    const response = await fetch(
      'https://us-central1-happoria.cloudfunctions.net/reverseGeocodeFn',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng }),
      }
    );

    const data = await response.json();
    console.log('📍 fetchLocationNameFromCoords response:', data);

    // ✅ Block invalid or fallback values like "@radius(...)"
    if (
      !data?.formattedLocation ||
      typeof data.formattedLocation !== 'string' ||
      data.formattedLocation.startsWith('@') ||
      data.formattedLocation.includes('radius')
    ) {
      console.warn('⚠️ Invalid formattedLocation from reverseGeocodeFn:', data.formattedLocation);
      return null;
    }

    return data.formattedLocation;
  } catch (err) {
    console.error('❌ Error in fetchLocationNameFromCoords:', err);
    return null;
  }
};
