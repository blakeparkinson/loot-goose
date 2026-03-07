import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function deriveTagsFromHunt(huntData: any): string[] {
  const haystack = `${huntData?.title ?? ''} ${huntData?.prompt ?? ''} ${
    Array.isArray(huntData?.items) ? huntData.items.map((item: any) => item?.name ?? '').join(' ') : ''
  }`.toLowerCase();

  const tags: string[] = [];
  const matches: Array<[string, RegExp]> = [
    ['history', /\b(history|historic|old|museum|heritage)\b/],
    ['art', /\b(art|mural|gallery|street art|graffiti)\b/],
    ['food', /\b(food|coffee|cafe|bakery|restaurant|bar|drink)\b/],
    ['nature', /\b(nature|park|garden|tree|river|waterfront|outdoor)\b/],
    ['weird', /\b(weird|funny|chaos|bizarre|odd|face)\b/],
    ['local', /\b(local|hidden gem|neighborhood|locals)\b/],
    ['architecture', /\b(building|architecture|design|plaza)\b/],
  ];

  for (const [tag, regex] of matches) {
    if (regex.test(haystack)) tags.push(tag);
  }

  return tags.slice(0, 4);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const query: string = body.query ?? '';
    const limit: number = Math.min(body.limit ?? 30, 50);
    const offset: number = body.offset ?? 0;

    let dbQuery = supabase
      .from('public_hunts')
      .select('id, code, title, location, difficulty, total_points, item_count, plays, created_at, hunt_data')
      .order('plays', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (query.trim()) {
      dbQuery = dbQuery.or(`title.ilike.%${query.trim()}%,location.ilike.%${query.trim()}%`);
    }

    const { data, error } = await dbQuery;

    if (error) throw new Error(error.message);

    const rows = (data ?? []).map((row: any) => ({
      ...row,
      tags: Array.isArray(row.hunt_data?.tags) && row.hunt_data.tags.length > 0
        ? row.hunt_data.tags
        : deriveTagsFromHunt(row.hunt_data),
      route_distance_miles: row.hunt_data?.routeMetrics?.estimatedDistanceMiles ?? null,
    }));

    return new Response(JSON.stringify(rows), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
