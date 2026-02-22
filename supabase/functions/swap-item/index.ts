import OpenAI from 'npm:openai';

const client = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { location, prompt, minPts, maxPts, existingItemNames } = await req.json();

    const avoidList = Array.isArray(existingItemNames) && existingItemNames.length > 0
      ? `\n\nDo NOT generate any of these already-existing items: ${existingItemNames.join(', ')}`
      : '';

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are Loot Goose, a fun AI that creates scavenger hunt items. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: `Generate ONE new scavenger hunt item for the following:

Location: ${location}
Theme: ${prompt}
Points range: ${minPts}-${maxPts}${avoidList}

Return JSON in this exact format:
{
  "name": "Short item name (3-5 words)",
  "description": "What to find and why (1-2 sentences)",
  "hint": "A helpful but not too easy hint",
  "points": <number between ${minPts} and ${maxPts}>,
  "sublocation": "Specific named spot within the location",
  "geocodeQuery": "Precise search query for geocoding this spot"
}

Make it fun, achievable, specific to the location and theme. Be creative and slightly silly.`,
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
