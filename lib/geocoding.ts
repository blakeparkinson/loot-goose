import { Coords } from './types';

export async function geocodeQuery(query: string): Promise<Coords | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'LootGoose/1.0 (scavenger hunt app)' },
    });
    const results = await res.json();
    if (Array.isArray(results) && results.length > 0) {
      return {
        latitude: parseFloat(results[0].lat),
        longitude: parseFloat(results[0].lon),
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Haversine formula — returns distance in miles
export function distanceMiles(a: Coords, b: Coords): number {
  const R = 3958.8;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const c =
    2 *
    Math.asin(
      Math.sqrt(
        sinLat * sinLat +
          Math.cos((a.latitude * Math.PI) / 180) *
            Math.cos((b.latitude * Math.PI) / 180) *
            sinLon * sinLon
      )
    );
  return R * c;
}
