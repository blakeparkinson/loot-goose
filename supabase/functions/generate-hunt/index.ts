import Anthropic from 'npm:@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { location, prompt, count, minPts, maxPts } = await req.json();

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `You are Loot Goose, a fun AI that creates scavenger hunt lists. Generate a scavenger hunt for the following:

Location: ${location}
Theme: ${prompt}
Number of items: ${count}
Points range: ${minPts}-${maxPts} per item

Return ONLY valid JSON in this exact format:
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

Make the items fun, achievable, specific to the location and theme, and ranging from easy to harder. Be creative and slightly silly. No markdown, just raw JSON.`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');

    const jsonText = content.text.trim();
    const data = JSON.parse(jsonText);

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
