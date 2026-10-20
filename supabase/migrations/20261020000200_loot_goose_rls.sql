-- These tables had RLS off, so anyone holding the anon key (it ships in the app)
-- could read, edit or delete every row through the REST API, bypassing the edge
-- functions. The edge functions use the service role, which bypasses RLS, so
-- turning it on with no policies closes direct access without changing the app.
ALTER TABLE public_hunts ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_curations ENABLE ROW LEVEL SECURITY;
-- Created outside these migrations, hence IF EXISTS.
ALTER TABLE IF EXISTS shared_hunts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS coop_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS coop_completions ENABLE ROW LEVEL SECURITY;

-- The co-op screen subscribes to coop_completions inserts over Realtime with the
-- anon key (lib/coopClient.ts), and Realtime only delivers rows the role can SELECT.
-- Read-only: writes still go through complete-coop-item.
DO $$
BEGIN
  IF to_regclass('public.coop_completions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Anon can read co-op completions for realtime" ON coop_completions;
    CREATE POLICY "Anon can read co-op completions for realtime"
    ON coop_completions FOR SELECT
    TO anon
    USING (true);
  END IF;
END
$$;
