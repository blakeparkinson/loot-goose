-- Remove personal data from hunts that were stored before publish, share and co-op
-- started whitelisting fields (supabase/functions/_shared/shareableHunt.ts):
-- photo URLs, the AI's notes on those photos, completion times, and the hunt
-- centre point (the player's own GPS fix for Goose Loose hunts).
CREATE OR REPLACE FUNCTION pg_temp.scrub_hunt_data(h jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN jsonb_typeof(h) <> 'object' THEN h
    ELSE (h - 'coords' - 'startedAt' - 'completedAt' - 'publishedCode')
      || CASE
        WHEN jsonb_typeof(h -> 'items') = 'array' THEN jsonb_build_object('items', COALESCE((
          SELECT jsonb_agg(
            CASE WHEN jsonb_typeof(item) = 'object'
              THEN item - 'photoUri' - 'verificationNote' - 'completedAt'
              ELSE item
            END
            ORDER BY ord
          )
          FROM jsonb_array_elements(h -> 'items') WITH ORDINALITY AS t(item, ord)
        ), '[]'::jsonb))
        ELSE '{}'::jsonb
      END
  END
$$;

-- shared_hunts and coop_sessions were created outside these migrations, so skip
-- any table that doesn't exist (e.g. a fresh local database).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['public_hunts', 'shared_hunts', 'coop_sessions'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format(
        'UPDATE public.%I SET hunt_data = pg_temp.scrub_hunt_data(hunt_data)
         WHERE hunt_data IS DISTINCT FROM pg_temp.scrub_hunt_data(hunt_data)',
        t
      );
    END IF;
  END LOOP;
END
$$;
