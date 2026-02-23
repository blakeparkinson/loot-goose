import OpenAI from 'npm:openai';

const client = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function nominatimGeocode(query: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'LootGoose/1.0 (scavenger hunt app)' },
    });
    const results = await res.json();
    if (Array.isArray(results) && results.length > 0) {
      return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// Nearest-neighbor sort: starting from `origin`, greedily pick the closest unvisited stop.
function sortByWalkingOrder<T extends { coords: { lat: number; lon: number } | null }>(
  items: T[],
  origin: { lat: number; lon: number },
): T[] {
  const withCoords = items.filter(i => i.coords !== null);
  const noCoords = items.filter(i => i.coords === null);

  const remaining = [...withCoords];
  const ordered: T[] = [];
  let current = origin;

  while (remaining.length > 0) {
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, remaining[i].coords!);
      if (d < closestDist) { closestDist = d; closestIdx = i; }
    }
    const next = remaining.splice(closestIdx, 1)[0];
    ordered.push(next);
    current = next.coords!;
  }

  return [...ordered, ...noCoords];
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

1. GEOGRAPHIC ORDER: Stops must be sequenced so a player travels in ONE DIRECTION along the described route from start to finish. Never backtrack. If a transit line is mentioned (streetcar, bus, subway), stops must follow that line's actual path in order.

2. REAL PLACES ONLY: Every stop must be a real, named, specific place that actually exists — a business, landmark, monument, mural, park feature, or notable intersection. Absolutely NO vague descriptions like "a colorful wall", "a sunny spot", or "a historic building". Use the actual name.

3. TRANSIT AWARENESS: If a transit line is mentioned, each stop must be within a 2-block walk of that line. Name the nearest transit stop in the sublocation field.

4. SUBLOCATION = REAL NAME: Use the actual name and address of the place — e.g. "Columns Hotel, 3811 St. Charles Ave" or "Audubon Park Shelter #3 near the lagoon". Not a description.

5. GEOCODE PRECISION: geocodeQuery must be specific enough to find the exact place on OpenStreetMap — include the establishment name, street number and name if known, neighborhood, and city/state.

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

    // Geocode start location + all stops in parallel
    const [huntCoords, ...stopCoords] = await Promise.all([
      nominatimGeocode(location),
      ...(data.items as any[]).map((item: any) => nominatimGeocode(item.geocodeQuery ?? item.sublocation ?? item.name)),
    ]);

    // Attach coords to each item
    const itemsWithCoords = (data.items as any[]).map((item: any, i: number) => ({
      ...item,
      coords: stopCoords[i],
    }));

    // Sort into nearest-neighbor walking order from the hunt start
    const origin = huntCoords ?? (stopCoords.find(c => c !== null) as { lat: number; lon: number } | null);
    const sortedItems = origin
      ? sortByWalkingOrder(itemsWithCoords, origin)
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
