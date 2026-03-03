import OpenAI from 'npm:openai';

const client = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });
const GMAPS_KEY = Deno.env.get('GOOGLE_MAPS_SERVER_API_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Geocoding strategy: Google Maps first (most complete, handles businesses well),
// then Photon (OSM, free, no key), then Nominatim (OSM fallback).
// Distance guard: discard any result more than 10 km from hunt origin —
// tight enough to catch wrong-city/wrong-borough errors, loose enough for longer routes.
const GEOCODE_MAX_KM = 10;
const BBOX_DEG = 0.15; // ±0.15° ≈ 10–11 mi tight bounding box for OSM geocoders

async function geocode(
  query: string,
  hint?: { lat: number; lon: number },
): Promise<{ lat: number; lon: number } | null> {
  // 1. Try Google Maps Geocoding (most accurate, handles businesses & sub-features)
  if (GMAPS_KEY) {
    try {
      let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GMAPS_KEY}`;
      if (hint) {
        // Viewport bias: strongly prefer results near the hunt origin
        const d = 0.12; // ~13 km bias radius
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

  // 3. Nominatim (OSM) last resort
  try {
    let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    if (hint) {
      const minLon = hint.lon - BBOX_DEG, maxLon = hint.lon + BBOX_DEG;
      const minLat = hint.lat - BBOX_DEG, maxLat = hint.lat + BBOX_DEG;
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
      `?roundtrip=false&source=first&destination=last&steps=false&overview=false`;

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
          content: `You are Loot Goose, a fun AI that designs real-world scavenger hunts as geographically ordered walking routes. You have strong knowledge of real places, streets, and neighborhoods. Always respond with valid JSON only.`,
        },
        {
          role: 'user',
          content: `Design a scavenger hunt with STRICTLY ORDERED stops along a real route.

${locationLine}
Route & theme: ${prompt}
Number of stops: ${count}
Points range: ${minPts}-${maxPts} per stop${weatherLine}

STEP 1 — CLASSIFY:
Determine if this is a ROUND-TRIP or ONE-WAY route.
ROUND-TRIP signals: user mentions going TO a named destination AND coming back (e.g. "going to [place] and back", "find stops on the way and on the way back", "starting at X going to Y").
ONE-WAY: single direction, no named turnaround.

STEP 2 — IDENTIFY NAMED DESTINATION (round-trip only):
Extract the specific named place the user is going TO (e.g. a restaurant, park, landmark). This becomes the destination.
The starting location ("${location}") is the player's ORIGIN — it is NEVER one of the stops.

STEP 3 — GENERATE STOPS:
For ONE-WAY: Generate exactly ${count} stops from start to finish. Return them in the "items" array.

For ROUND-TRIP: Use the SPLIT FORMAT below. Generate:
- "outboundItems": ${Math.floor((count - 1) / 2)} stops between the starting location and the destination, in order of walking from origin toward destination
- "destinationItem": exactly 1 stop AT the named destination
- "returnItems": ${count - 1 - Math.floor((count - 1) / 2)} stops between the destination and the starting location, via a different path, in order of walking back toward origin

RULES (apply to all stops):
1. STOP COUNT: outboundItems + destinationItem + returnItems must total exactly ${count} for round-trip. items must total exactly ${count} for one-way.
2. REAL, MAPPABLE PLACES ONLY: Every stop must be a named place that exists as its own Google Maps entry — a building, park, café, museum, transit station, plaza, or well-known public landmark. Do NOT name sub-features of places (e.g. "rooftop garden," "lobby mural," "back alley"). Name the parent venue instead (e.g. "Rockefeller Center" not "Rockefeller Center Rooftop Gardens"). Do not invent local businesses you cannot verify.
3. TRANSIT: If a transit line is mentioned, each stop must be within 2 blocks of that line.
4. SUBLOCATION: Real name + address, e.g. "Columns Hotel, 3811 St. Charles Ave".
5. GEOCODE: Specific enough for Google Maps — include name, street address, city/state.

Return JSON in ONE of these two formats:

For ONE-WAY:
{
  "title": "A fun, punny hunt title",
  "routeType": "ONE_WAY",
  "items": [ <${count} stop objects in walking order> ]
}

For ROUND-TRIP:
{
  "title": "A fun, punny hunt title",
  "routeType": "ROUND_TRIP",
  "outboundItems": [ <${Math.floor((count - 1) / 2)} stops walking from origin toward destination> ],
  "destinationItem": { <1 stop at the named destination> },
  "returnItems": [ <${count - 1 - Math.floor((count - 1) / 2)} stops walking from destination back toward origin> ]
}

Each stop object:
{
  "name": "Short stop name (3-6 words)",
  "description": "What to find or do here and why it fits the theme (1-2 sentences)",
  "lore": "2-3 sentences of interesting history, trivia, or surprising context about this specific place. Real stories, founding dates, famous connections, or quirky facts — not navigation tips.",
  "points": <number between ${minPts} and ${maxPts}>,
  "sublocation": "Real place name + address/cross-street",
  "geocodeQuery": "Precise query for Google Maps, e.g. 'Duane Park, Hudson St & Duane St, New York, NY'"
}

Give harder-to-find or more obscure spots more points; obvious or easy ones fewer.`,
        },
      ],
    });

    const text = response.choices[0].message.content ?? '{}';
    const data = JSON.parse(text);

    // Flatten round-trip split format (outboundItems + destinationItem + returnItems) into
    // a single ordered items array. For one-way routes, data.items is used directly.
    const isRoundTrip = data.routeType === 'ROUND_TRIP' &&
      (Array.isArray(data.outboundItems) || data.destinationItem != null || Array.isArray(data.returnItems));

    let rawItems: any[];
    if (isRoundTrip) {
      const outbound: any[] = Array.isArray(data.outboundItems) ? data.outboundItems : [];
      const dest: any[] = data.destinationItem ? [data.destinationItem] : [];
      const ret: any[] = Array.isArray(data.returnItems) ? data.returnItems : [];
      rawItems = [...outbound, ...dest, ...ret];
      console.log(`Round-trip: ${outbound.length} outbound + ${dest.length} dest + ${ret.length} return = ${rawItems.length} stops`);
    } else {
      rawItems = Array.isArray(data.items) ? data.items : [];
    }

    // Geocode hunt origin first, then use it as a location hint for all stop geocoding
    const huntCoords = await geocode(location);

    const stopCoords = await Promise.all(
      rawItems.map((item: any) =>
        geocode(item.geocodeQuery ?? item.sublocation ?? item.name, huntCoords ?? undefined)
      ),
    );

    // Outlier filter: two-pass guard against geocoder misses.
    // Pass 1 — hard distance from hunt origin: any stop geocoded more than 5 km
    //   from where the user is is almost certainly a geocoder error (wrong city/borough).
    //   5 km = ~3 miles, generous enough for any reasonable walking hunt.
    // Pass 2 — centroid spread: after removing obvious outliers, recompute the median
    //   centroid of remaining stops and drop anything > 2 km from that center.
    //   This catches subtler wrong-neighborhood geocodes.
    const MAX_FROM_ORIGIN_KM = 5.0;
    const MAX_FROM_CENTROID_KM = 2.0;

    // Pass 1
    const originFilteredCoords = stopCoords.map((coords) => {
      if (!coords || !huntCoords) return coords;
      const dist = haversineKm(coords, huntCoords);
      if (dist > MAX_FROM_ORIGIN_KM) {
        console.log(`Dropping stop ${dist.toFixed(1)} km from origin (geocoder error):`, coords);
        return null;
      }
      return coords;
    });

    // Pass 2 — centroid of origin-filtered stops
    const validCoords = originFilteredCoords.filter((c): c is { lat: number; lon: number } => c !== null);
    let centroid: { lat: number; lon: number } | null = null;
    if (validCoords.length >= 2) {
      const sortedLat = [...validCoords.map(c => c.lat)].sort((a, b) => a - b);
      const sortedLon = [...validCoords.map(c => c.lon)].sort((a, b) => a - b);
      const mid = Math.floor(sortedLat.length / 2);
      centroid = { lat: sortedLat[mid], lon: sortedLon[mid] };
    }
    const filteredStopCoords = originFilteredCoords.map((coords) => {
      if (!coords || !centroid) return coords;
      const dist = haversineKm(coords, centroid);
      if (dist > MAX_FROM_CENTROID_KM) {
        console.log(`Dropping outlier stop at ${coords.lat},${coords.lon} — ${dist.toFixed(1)} km from centroid`);
        return null;
      }
      return coords;
    });

    // Attach coords to each item, dropping any that failed to geocode.
    // A geocoding failure is a strong signal the place was hallucinated.
    const itemsWithCoords = rawItems
      .map((item: any, i: number) => ({ ...item, coords: filteredStopCoords[i] }))
      .filter((item) => {
        if (!item.coords) {
          console.log(`Dropping stop with no coords (likely hallucinated): ${item.name}`);
          return false;
        }
        return true;
      });

    // For round-trip routes, preserve the LLM's carefully constructed outbound→destination→return
    // ordering rather than re-optimizing (OSRM doesn't understand round-trip legs).
    // For one-way routes, use OSRM to optimize the walking order.
    const origin = huntCoords ?? (stopCoords.find(c => c !== null) as { lat: number; lon: number } | null);
    const sortedItems = (!isRoundTrip && origin)
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
