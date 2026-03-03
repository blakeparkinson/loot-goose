import OpenAI from 'npm:openai';

const client = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function nominatimGeocode(query: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'LootGoose/1.0 (scavenger hunt app)' } });
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
    const { location, prompt, minPts, maxPts, feedback, currentStops, incompleteCount } = await req.json();

    const stopList = (currentStops as any[])
      .map((s: any, i: number) => `${i + 1}. ${s.name}${s.sublocation ? ` (${s.sublocation})` : ''}${s.completed ? ' [COMPLETED]' : ''}`)
      .join('\n');

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are Loot Goose, a fun AI that redesigns scavenger hunt routes based on player feedback. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: `A player wants to improve their scavenger hunt based on feedback. Replace only the INCOMPLETE stops with better ones.

Location: ${location}
Hunt theme: ${prompt}
Points range: ${minPts}-${maxPts} per stop

Current stops:
${stopList}

Player feedback: "${feedback}"

Generate ${incompleteCount} replacement stops that address the feedback while keeping the same location and theme. Do NOT recreate any of the completed stops.

Rules:
- REAL PLACES ONLY: actual named businesses, landmarks, or features.
- GEOGRAPHIC ORDER: stops should form a sensible walking route.
- sublocation = real name + address.
- geocodeQuery must be precise enough for OpenStreetMap.

Return JSON:
{
  "items": [
    {
      "name": "Short stop name (3-6 words)",
      "description": "What to find at this real place and why it fits (1-2 sentences)",
      "lore": "2-3 sentences of interesting history, trivia, or surprising facts about this place",
      "points": <number between ${minPts} and ${maxPts}>,
      "sublocation": "Real place name + address",
      "geocodeQuery": "Precise OSM query"
    }
  ]
}`,
        },
      ],
    });

    const text = response.choices[0].message.content ?? '{}';
    const data = JSON.parse(text);

    // Geocode and sort new stops
    const startCoords = await nominatimGeocode(location);
    const stopCoords = await Promise.all(
      (data.items as any[]).map((item: any) => nominatimGeocode(item.geocodeQuery ?? item.sublocation ?? item.name))
    );

    const itemsWithCoords = (data.items as any[]).map((item: any, i: number) => ({
      ...item,
      coords: stopCoords[i],
    }));

    const origin = startCoords ?? (stopCoords.find(c => c !== null) as { lat: number; lon: number } | null);
    const sortedItems = origin ? sortByWalkingOrder(itemsWithCoords, origin) : itemsWithCoords;

    return new Response(JSON.stringify({ items: sortedItems }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
