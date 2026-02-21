import OpenAI from 'npm:openai';

const client = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { imageBase64, itemName, itemDescription, location } = await req.json();

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      max_tokens: 256,
      messages: [
        {
          role: 'system',
          content: 'You are a scavenger hunt judge for Loot Goose. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'low',
              },
            },
            {
              type: 'text',
              text: `The player is at ${location} and needs to find: "${itemName}" — ${itemDescription}

Does this photo show what they're looking for? Be generous and fun — if they made a reasonable attempt that matches the spirit of the item, accept it.

Return JSON:
{
  "success": true or false,
  "message": "A short, fun, encouraging message. If success, celebrate! If not, give a playful nudge on what to try."
}`,
            },
          ],
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
