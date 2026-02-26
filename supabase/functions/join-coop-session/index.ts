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
    const { code, playerName } = await req.json();

    if (!code || !playerName) {
      return new Response(JSON.stringify({ error: 'code and playerName are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalized = String(code).trim().toUpperCase();

    // Fetch session (check not expired)
    const { data: session, error: sessionError } = await supabase
      .from('coop_sessions')
      .select('hunt_data, players, expires_at')
      .eq('code', normalized)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Hunt not found. Check the code and try again.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (new Date(session.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'This co-op session has expired.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Append player (skip if same name already present)
    const existingPlayers: { name: string; joinedAt: string }[] = session.players ?? [];
    const alreadyIn = existingPlayers.some((p) => p.name === playerName);
    if (!alreadyIn) {
      const newPlayer = { name: String(playerName), joinedAt: new Date().toISOString() };
      await supabase
        .from('coop_sessions')
        .update({ players: [...existingPlayers, newPlayer] })
        .eq('code', normalized);
    }

    // Fetch all current completions
    const { data: completions } = await supabase
      .from('coop_completions')
      .select('*')
      .eq('session_code', normalized)
      .order('completed_at', { ascending: true });

    const allPlayers = alreadyIn
      ? existingPlayers
      : [...existingPlayers, { name: String(playerName), joinedAt: new Date().toISOString() }];

    return new Response(JSON.stringify({
      huntData: session.hunt_data,
      completions: completions ?? [],
      players: allPlayers,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
