import OpenAI from 'npm:openai';

const client = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });
const GMAPS_KEY = Deno.env.get('GOOGLE_MAPS_SERVER_API_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Photon (by Komoot) — free, no key, great at finding businesses in OSM.
// When a hint is provided we pass a strict bbox (±0.75° ≈ 50 mi) AND a
// post-result distance check so we never return results from the wrong state.
const GEOCODE_MAX_KM = 80; // discard any result more than ~50 mi from hunt origin
const BBOX_DEG = 0.75;     // ±0.75° lat/lon bounding box for search

async function geocode(
  query: string,
  hint?: { lat: number; lon: number },
): Promise<{ lat: number; lon: number } | null> {
  // Try Photon first
  try {
    let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`;
    if (hint) {
      url += `&lat=${hint.lat}&lon=${hint.lon}`;
      // Hard bbox so Photon only considers results inside this box
      const minLon = hint.lon - BBOX_DEG, maxLon = hint.lon + BBOX_DEG;
      const minLat = hint.lat - BBOX_DEG, maxLat = hint.lat + BBOX_DEG;
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
  // Fallback to Nominatim — use viewbox+bounded to restrict to same area
  try {
    let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    if (hint) {
      const minLon = hint.lon - BBOX_DEG, maxLon = hint.lon + BBOX_DEG;
      const minLat = hint.lat - BBOX_DEG, maxLat = hint.lat + BBOX_DEG;
      // Nominatim viewbox: left,top,right,bottom (lon_min,lat_max,lon_max,lat_min)
      url += `&viewbox=${minLon},${maxLat},${maxLon},${minLat}&bounded=1`;
    }
    const res = await fetch(url, {
      headers: { 'User-Agent': 'LootGoose/1.0 (scavenger hunt app)' },
      signal: AbortSignal.timeout(6000),
    });
    const results = await res.json();
    if (Array.isArray(results) && results.length > 0) {
      const lat = parseFloat(results[0].lat), lon = parseFloat(results[0].lon);
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

async function optimizeRouteOrder<T extends { coords: { lat: number; lon: number } | null }>(
  items: T[],
  origin: { lat: number; lon: number },
): Promise<T[]> {
  const withCoords = items.filter(i => i.coords !== null);
  const noCoords = items.filter(i => i.coords === null);

  if (withCoords.length < 2) return items;

  try {
    // OSRM Trip API: free, no key, uses real walking road network.
    // Circular route: origin + all stops, roundtrip=true so it loops back to start.
    const allPoints = [origin, ...withCoords.map(i => i.coords!)];
    const coordStr = allPoints.map(c => `${c.lon},${c.lat}`).join(';');

    const url = `https://router.project-osrm.org/trip/v1/foot/${coordStr}` +
      `?roundtrip=true&source=first&steps=false&overview=false`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();

    console.log('OSRM Trip status:', data.code, '— stops:', withCoords.length);

    if (data.code === 'Ok' && data.trips?.length > 0) {
      // waypoints[i].waypoint_index = this input coordinate's position in the optimized trip.
      // waypoints[0] = origin (skip). waypoints[1..n] = our stops.
      // Sort stops by their trip_index to get the optimized order.
      const waypoints: Array<{ waypoint_index: number }> = data.waypoints;
      const stopEntries = waypoints.slice(1).map((wp, i) => ({ stopIdx: i, tripPos: wp.waypoint_index }));
      stopEntries.sort((a, b) => a.tripPos - b.tripPos);
      const ordered = stopEntries.map(e => withCoords[e.stopIdx]);

      if (ordered.length === withCoords.length) {
        console.log('OSRM ordering succeeded');
        return [...ordered, ...noCoords];
      }
    }

    console.error('OSRM failed or bad response:', data.code, data.message ?? '');
  } catch (e) {
    console.error('OSRM error:', e);
  }

  // Fallback: nearest-neighbor + 2-opt
  console.log('Using nearest-neighbor + 2-opt fallback');
  return sortByWalkingOrderFallback(items, origin);
}

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function routeLength(coords: Array<{ lat: number; lon: number }>, origin: { lat: number; lon: number }): number {
  let total = 0;
  let prev = origin;
  for (const c of coords) { total += haversineKm(prev, c); prev = c; }
  return total;
}

function sortByWalkingOrderFallback<T extends { coords: { lat: number; lon: number } | null }>(
  items: T[],
  origin: { lat: number; lon: number },
): T[] {
  const withCoords = items.filter(i => i.coords !== null);
  const noCoords = items.filter(i => i.coords === null);
  if (withCoords.length === 0) return items;

  // Nearest-neighbor
  const remaining = [...withCoords];
  const ordered: T[] = [];
  let current = origin;
  while (remaining.length > 0) {
    let closestIdx = 0, closestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, remaining[i].coords!);
      if (d < closestDist) { closestDist = d; closestIdx = i; }
    }
    const next = remaining.splice(closestIdx, 1)[0];
    ordered.push(next);
    current = next.coords!;
  }

  // 2-opt improvement
  let best = ordered;
  let bestLen = routeLength(best.map(i => i.coords!), origin);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 2; j < best.length; j++) {
        const candidate = [...best.slice(0, i + 1), ...best.slice(i + 1, j + 1).reverse(), ...best.slice(j + 1)];
        const len = routeLength(candidate.map(r => r.coords!), origin);
        if (len < bestLen - 0.001) { best = candidate; bestLen = len; improved = true; }
      }
    }
  }

  return [...best, ...noCoords];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { location, routeArea, prompt, count, minPts, maxPts, weather } = await req.json();

    const locationLine = routeArea
      ? `Starting point: ${location}\nRoute through: ${routeArea}`
      : `Location: ${location}`;

    const weatherLine = weather
      ? `\nCurrent weather: ${weather} — tailor stops to suit conditions. Skip anything unpleasant or unsafe in this weather. Lean into it where fun (puddle reflections on a rainy day, ambitious snowmen in snow, etc).`
      : '';

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are Loot Goose, a fun AI that designs real-world scavenger hunts as geographically ordered routes. You have strong knowledge of real places, streets, transit lines, and neighborhoods. Always respond with valid JSON only.`,
        },
        {
          role: 'user',
          content: `Design a scavenger hunt with STRICTLY ORDERED stops along a real route.

${locationLine}
Route & theme: ${prompt}
Number of stops: ${count}
Points range: ${minPts}-${maxPts} per stop${weatherLine}

CRITICAL RULES — follow these exactly:

1. WALKABLE DISTANCE: The entire route must be completable on foot. Total straight-line distance across all stops must be under 1.5 miles (2.5 km). No single gap between consecutive stops should exceed 0.4 miles (650 m). All stops must be in the same walkable neighborhood — do NOT spread stops across different parts of a city.

2. GEOGRAPHIC ORDER: Stops must be sequenced so a player travels in ONE DIRECTION along the described route from start to finish. Never backtrack. If a transit line is mentioned (streetcar, bus, subway), stops must follow that line's actual path in order.

3. REAL PLACES ONLY: Every stop must be a real, named, specific place that actually exists — a business, landmark, monument, mural, park feature, or notable intersection. Absolutely NO vague descriptions like "a colorful wall", "a sunny spot", or "a historic building". Use the actual name.

4. TRANSIT AWARENESS: If a transit line is mentioned, each stop must be within a 2-block walk of that line. Name the nearest transit stop in the sublocation field.

5. SUBLOCATION = REAL NAME: Use the actual name and address of the place — e.g. "Columns Hotel, 3811 St. Charles Ave" or "Audubon Park Shelter #3 near the lagoon". Not a description.

6. GEOCODE PRECISION: geocodeQuery must be specific enough to find the exact place on Google Maps — include the establishment name, street number and name if known, neighborhood, and city/state.

Return JSON in this exact format:
{
  "title": "A fun, punny hunt title",
  "items": [
    {
      "name": "Short stop name (3-6 words)",
      "description": "What to find or do at this specific real place and why it fits the theme (1-2 sentences)",
      "hint": "A helpful but not too easy hint for finding the exact spot",
      "points": <number between ${minPts} and ${maxPts}>,
      "sublocation": "Real place name + address/cross-street, e.g. 'Columns Hotel Bar, 3811 St. Charles Ave, Uptown'",
      "geocodeQuery": "Precise query, e.g. 'The Columns Hotel, 3811 St Charles Ave, New Orleans, LA'"
    }
  ]
}

Give harder-to-find or more obscure spots more points; obvious or easy ones fewer.`,
        },
      ],
    });

    const text = response.choices[0].message.content ?? '{}';
    const data = JSON.parse(text);

    // Geocode hunt origin first, then use it as a location hint for all stop geocoding
    const huntCoords = await geocode(location);

    const stopCoords = await Promise.all(
      (data.items as any[]).map((item: any) =>
        geocode(item.geocodeQuery ?? item.sublocation ?? item.name, huntCoords ?? undefined)
      ),
    );

    // Outlier filter: compute median centroid of all geocoded stops, then null out
    // any stop whose coords are more than 2 km from that centroid.
    // This catches AI stops placed in the wrong part of a city.
    const validCoords = stopCoords.filter((c): c is { lat: number; lon: number } => c !== null);
    let centroid: { lat: number; lon: number } | null = null;
    if (validCoords.length >= 2) {
      const sortedLat = [...validCoords.map(c => c.lat)].sort((a, b) => a - b);
      const sortedLon = [...validCoords.map(c => c.lon)].sort((a, b) => a - b);
      const mid = Math.floor(sortedLat.length / 2);
      centroid = { lat: sortedLat[mid], lon: sortedLon[mid] };
    }
    const MAX_STOP_SPREAD_KM = 2.0;
    const filteredStopCoords = stopCoords.map((coords) => {
      if (!coords || !centroid) return coords;
      const dist = haversineKm(coords, centroid);
      if (dist > MAX_STOP_SPREAD_KM) {
        console.log(`Dropping outlier stop at ${coords.lat},${coords.lon} — ${dist.toFixed(1)} km from centroid`);
        return null;
      }
      return coords;
    });

    // Attach coords to each item
    const itemsWithCoords = (data.items as any[]).map((item: any, i: number) => ({
      ...item,
      coords: filteredStopCoords[i],
    }));

    // Use Google Directions API to get optimized walking order (falls back to nearest-neighbor + 2-opt)
    const origin = huntCoords ?? (stopCoords.find(c => c !== null) as { lat: number; lon: number } | null);
    const sortedItems = origin
      ? await optimizeRouteOrder(itemsWithCoords, origin)
      : itemsWithCoords;

    return new Response(JSON.stringify({ ...data, items: sortedItems, huntCoords }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
