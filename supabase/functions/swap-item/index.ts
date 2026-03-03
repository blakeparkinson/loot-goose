import OpenAI from 'npm:openai';

const client = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { location, prompt, minPts, maxPts, existingItemNames, customPrompt } = await req.json();

    const avoidList = Array.isArray(existingItemNames) && existingItemNames.length > 0
      ? `\n\nDo NOT duplicate any of these existing stops: ${existingItemNames.join(', ')}`
      : '';

    const whatToFind = customPrompt
      ? `Specific request: ${customPrompt}\nHunt theme for context: ${prompt}`
      : `Theme: ${prompt}`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are Loot Goose, a fun AI that creates scavenger hunt stops. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: `Generate ONE new scavenger hunt stop to replace an existing one:

Location/area: ${location}
${whatToFind}
Points range: ${minPts}-${maxPts}${avoidList}

Rules:
- Must be a REAL, NAMED, SPECIFIC place (actual business, landmark, or named feature).
- sublocation = real name + address of the place.
- geocodeQuery must be precise enough to find it on OpenStreetMap.

Return JSON in this exact format:
{
  "name": "Short stop name (3-6 words)",
  "description": "What to find at this real place and why it fits (1-2 sentences)",
  "lore": "2-3 sentences of interesting history, trivia, or surprising facts about this place",
  "points": <number between ${minPts} and ${maxPts}>,
  "sublocation": "Real place name + address",
  "geocodeQuery": "Precise OSM query"
}`,
        },
      ],
    });

    const text = response.choices[0].message.content ?? '{}';
    const item = JSON.parse(text);

    return new Response(JSON.stringify(item), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
