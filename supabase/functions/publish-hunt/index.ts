import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { huntData } = await req.json();

    if (!huntData) {
      return new Response(JSON.stringify({ error: 'huntData is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const title: string = huntData.title ?? 'Untitled Hunt';
    const location: string = huntData.location ?? '';
    const difficulty: string = huntData.difficulty ?? 'medium';
    const totalPoints: number = huntData.totalPoints ?? 0;
    const itemCount: number = Array.isArray(huntData.items) ? huntData.items.length : 0;

    // Try to insert with a unique code, retry on collision
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const { error } = await supabase
        .from('public_hunts')
        .insert({
          code,
          hunt_data: huntData,
          title,
          location,
          difficulty,
          total_points: totalPoints,
          item_count: itemCount,
        });

      if (!error) {
        return new Response(JSON.stringify({ code }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Only retry on unique constraint violations
      if (!error.message.includes('unique') && !error.message.includes('duplicate')) {
        throw new Error(error.message);
      }
    }

    throw new Error('Could not generate a unique code. Please try again.');
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
