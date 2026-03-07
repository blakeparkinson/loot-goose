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

function toLibrarySummary(row: any) {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    location: row.location,
    difficulty: row.difficulty,
    total_points: row.total_points,
    item_count: row.item_count,
    plays: row.plays,
    created_at: row.created_at,
    tags: Array.isArray(row.hunt_data?.tags) && row.hunt_data.tags.length > 0
      ? row.hunt_data.tags
      : deriveTagsFromHunt(row.hunt_data),
    route_distance_miles: row.hunt_data?.routeMetrics?.estimatedDistanceMiles ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('library_curations')
      .select('id, slot, action_type, hunt_code, title, subtitle, badge_text, preset_data, sort_order, starts_at, ends_at')
      .lte('starts_at', nowIso)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order('slot', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const curations = data ?? [];
    const huntCodes = curations
      .filter((row) => row.action_type === 'hunt' && row.hunt_code)
      .map((row) => row.hunt_code);

    let huntRows: any[] = [];
    if (huntCodes.length > 0) {
      const { data: hunts, error: huntsError } = await supabase
        .from('public_hunts')
        .select('id, code, title, location, difficulty, total_points, item_count, plays, created_at, hunt_data')
        .in('code', huntCodes);

      if (huntsError) throw new Error(huntsError.message);
      huntRows = hunts ?? [];
    }

    const huntByCode = new Map(huntRows.map((row) => [row.code, row]));
    const featured = curations
      .filter((row) => row.slot === 'featured')
      .map((row) => {
        if (row.action_type === 'hunt') {
          const hunt = huntByCode.get(row.hunt_code);
          if (!hunt) return null;
          return {
            ...toLibrarySummary(hunt),
            highlight_title: row.title,
            highlight_subtitle: row.subtitle,
            highlight_badge: row.badge_text,
          };
        }
        return {
          id: row.id,
          code: '',
          title: row.title,
          location: row.preset_data?.location ?? 'Anywhere',
          difficulty: row.preset_data?.difficulty ?? 'medium',
          total_points: 0,
          item_count: row.preset_data?.stopCount ?? 0,
          plays: 0,
          created_at: row.starts_at,
          tags: Array.isArray(row.preset_data?.suggestions) ? row.preset_data.suggestions.slice(0, 4) : [],
          route_distance_miles: null,
          highlight_title: row.title,
          highlight_subtitle: row.subtitle,
          highlight_badge: row.badge_text,
          preset_data: row.preset_data,
        };
      })
      .filter(Boolean);

    const weeklyChallengeRow = curations.find((row) => row.slot === 'weekly_challenge') ?? null;
    let weeklyChallenge = null;
    if (weeklyChallengeRow) {
      if (weeklyChallengeRow.action_type === 'hunt') {
        const hunt = huntByCode.get(weeklyChallengeRow.hunt_code);
        if (hunt) {
          weeklyChallenge = {
            type: 'hunt',
            ...toLibrarySummary(hunt),
            title: weeklyChallengeRow.title,
            subtitle: weeklyChallengeRow.subtitle,
            badge: weeklyChallengeRow.badge_text,
          };
        }
      } else {
        weeklyChallenge = {
          type: 'preset',
          title: weeklyChallengeRow.title,
          subtitle: weeklyChallengeRow.subtitle,
          badge: weeklyChallengeRow.badge_text,
          preset: weeklyChallengeRow.preset_data,
        };
      }
    }

    return new Response(JSON.stringify({ weeklyChallenge, featured }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
