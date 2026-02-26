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
    const { code, itemId, playerName, verificationNote } = await req.json();

    if (!code || !itemId || !playerName) {
      return new Response(JSON.stringify({ error: 'code, itemId, and playerName are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalized = String(code).trim().toUpperCase();

    // Verify session exists and is not expired
    const { data: session, error: sessionError } = await supabase
      .from('coop_sessions')
      .select('hunt_data, expires_at')
      .eq('code', normalized)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Session not found.' }), {
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

    // Verify itemId exists in the hunt template (anti-tamper)
    const items: { id: string }[] = session.hunt_data?.items ?? [];
    if (!items.some((i) => i.id === itemId)) {
      return new Response(JSON.stringify({ error: 'Item not found in this hunt.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert completion — ON CONFLICT DO NOTHING (first player to complete wins)
    const { error, count } = await supabase
      .from('coop_completions')
      .insert({
        session_code: normalized,
        item_id: itemId,
        player_name: String(playerName),
        verification_note: verificationNote ?? null,
      }, { count: 'exact' });

    if (error) {
      // Unique constraint violation — already completed by someone else
      if (error.message.includes('unique') || error.message.includes('duplicate') || error.code === '23505') {
        return new Response(JSON.stringify({ ok: false, alreadyCompleted: true }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(error.message);
    }

    if (count === 0) {
      return new Response(JSON.stringify({ ok: false, alreadyCompleted: true }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
