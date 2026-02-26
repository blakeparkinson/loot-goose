import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { code } = await req.json();

    if (!code) {
      return new Response(JSON.stringify({ error: 'code is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalizedCode = String(code).toUpperCase().trim();

    const { data, error } = await supabase
      .from('public_hunts')
      .select('hunt_data, plays')
      .eq('code', normalizedCode)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ error: 'Hunt not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Increment play count (non-critical, don't fail if it errors)
    supabase
      .from('public_hunts')
      .update({ plays: (data.plays ?? 0) + 1 })
      .eq('code', normalizedCode)
      .then(() => {});

    return new Response(JSON.stringify(data.hunt_data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
