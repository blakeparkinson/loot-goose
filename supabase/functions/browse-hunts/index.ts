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
    const body = await req.json().catch(() => ({}));
    const query: string = body.query ?? '';
    const limit: number = Math.min(body.limit ?? 30, 50);
    const offset: number = body.offset ?? 0;

    let dbQuery = supabase
      .from('public_hunts')
      .select('id, code, title, location, difficulty, total_points, item_count, plays, created_at')
      .order('plays', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (query.trim()) {
      dbQuery = dbQuery.or(`title.ilike.%${query.trim()}%,location.ilike.%${query.trim()}%`);
    }

    const { data, error } = await dbQuery;

    if (error) throw new Error(error.message);

    return new Response(JSON.stringify(data ?? []), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
