import OpenAI from 'npm:openai';

const client = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { location, prompt, count, minPts, maxPts } = await req.json();

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are Loot Goose, a fun AI that creates scavenger hunt lists. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: `Generate a scavenger hunt for the following:

Location: ${location}
Theme: ${prompt}
Number of items: ${count}
Points range: ${minPts}-${maxPts} per item

Return JSON in this exact format:
{
  "title": "A fun, punny hunt title",
  "items": [
    {
      "name": "Short item name (3-5 words)",
      "description": "What to find and why (1-2 sentences)",
      "hint": "A helpful but not too easy hint",
      "points": <number between ${minPts} and ${maxPts}>
    }
  ]
}

Make items fun, achievable, specific to the location and theme, ranging from easy to harder. Be creative and slightly silly.`,
        },
      ],
    });

    const text = response.choices[0].message.content ?? '{}';
    const data = JSON.parse(text);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
