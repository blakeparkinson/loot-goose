const GMAPS_KEY = Deno.env.get('GOOGLE_MAPS_SERVER_API_KEY') ?? '';
const GEOCODE_MAX_KM = 10;
const BBOX_DEG = 0.15;

export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export async function geocode(
  query: string,
  hint?: { lat: number; lon: number },
): Promise<{ lat: number; lon: number } | null> {
  // 1. Try Google Maps Geocoding
  if (GMAPS_KEY) {
    try {
      let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GMAPS_KEY}`;
      if (hint) {
        const d = 0.12;
        url += `&bounds=${hint.lat - d},${hint.lon - d}|${hint.lat + d},${hint.lon + d}`;
      }
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      const data = await res.json();
      if (data.status === 'OK' && data.results?.length > 0) {
        const { lat, lng: lon } = data.results[0].geometry.location;
        if (hint && haversineKm({ lat, lon }, hint) > GEOCODE_MAX_KM) {
          console.log('Google result too far from hint, discarding:', query);
        } else {
          return { lat, lon };
        }
      }
    } catch (e) {
      console.error('Google geocode error for:', query, e);
    }
  }

  // 2. Photon (OSM) fallback
  try {
    let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`;
    if (hint) {
      url += `&lat=${hint.lat}&lon=${hint.lon}`;
      const minLon = hint.lon - BBOX_DEG,
        maxLon = hint.lon + BBOX_DEG;
      const minLat = hint.lat - BBOX_DEG,
        maxLat = hint.lat + BBOX_DEG;
      url += `&bbox=${minLon},${minLat},${maxLon},${maxLat}`;
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const data = await res.json();
    if (data.features?.length > 0) {
      const [lon, lat] = data.features[0].geometry.coordinates;
      if (hint && haversineKm({ lat, lon }, hint) > GEOCODE_MAX_KM) {
        console.log('Photon result too far from hint, discarding:', query);
      } else {
        return { lat, lon };
      }
    }
  } catch (e) {
    console.error('Photon error for:', query, e);
  }

  // 3. Nominatim (OSM) last resort
  try {
    let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    if (hint) {
      const minLon = hint.lon - BBOX_DEG,
        maxLon = hint.lon + BBOX_DEG;
      const minLat = hint.lat - BBOX_DEG,
        maxLat = hint.lat + BBOX_DEG;
      url += `&viewbox=${minLon},${maxLat},${maxLon},${minLat}&bounded=1`;
    }
    const res = await fetch(url, {
      headers: { 'User-Agent': 'LootGoose/1.0 (scavenger hunt app)' },
      signal: AbortSignal.timeout(6000),
    });
    const results = await res.json();
    if (Array.isArray(results) && results.length > 0) {
      const lat = parseFloat(results[0].lat),
        lon = parseFloat(results[0].lon);
      if (hint && haversineKm({ lat, lon }, hint) > GEOCODE_MAX_KM) {
        console.log('Nominatim result too far from hint, discarding:', query);
        return null;
      }
      return { lat, lon };
    }
  } catch (e) {
    console.error('Nominatim error for:', query, e);
  }
  return null;
}
