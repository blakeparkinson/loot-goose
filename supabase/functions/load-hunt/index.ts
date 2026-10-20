import { createClient } from 'npm:@supabase/supabase-js@2';
import { guardRequest } from '../_shared/http.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  const { corsHeaders, early } = await guardRequest(req);
  if (early) return early;

  try {
    const { code } = await req.json();

    if (!code) {
      return new Response(JSON.stringify({ error: 'code is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalized = String(code).trim().toUpperCase();

    const { data, error } = await supabase
      .from('shared_hunts')
      .select('hunt_data')
      .eq('code', normalized)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ error: 'Hunt not found. Check the code and try again.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
