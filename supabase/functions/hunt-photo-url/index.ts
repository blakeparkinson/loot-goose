import { createClient } from 'npm:@supabase/supabase-js@2';
import { guardRequest } from '../_shared/http.ts';

// Temporary: lets installs from before the private bucket copy their uploaded photos
// onto the device. New photos are never uploaded. Remove this function (and empty the
// hunt-photos bucket) once those installs have had time to update.

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const MAX_PATHS = 20;
const SIGNED_URL_SECONDS = 120;
// Old uploads were stored as `${huntId}/${itemId}-${timestamp}.jpg`.
const PATH_PATTERN = /^[A-Za-z0-9_-]{1,100}\/[A-Za-z0-9_-]{1,150}\.jpg$/;

Deno.serve(async (req) => {
  const { corsHeaders, early } = await guardRequest(req, { rateLimit: { name: 'hunt-photo-url', limit: 30 } });
  if (early) return early;

  try {
    const { paths } = await req.json();
    if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_PATHS
      || !paths.every((p) => typeof p === 'string' && PATH_PATTERN.test(p))) {
      return new Response(JSON.stringify({ error: `paths must be 1-${MAX_PATHS} photo paths` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await supabase.storage
      .from('hunt-photos')
      .createSignedUrls(paths, SIGNED_URL_SECONDS);
    if (error) throw new Error(error.message);

    const urls: Record<string, string | null> = {};
    for (const row of data ?? []) {
      if (row.path) urls[row.path] = row.error ? null : row.signedUrl;
    }

    return new Response(JSON.stringify({ urls }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
