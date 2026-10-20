-- Per-IP call counts for the edge functions that spend OpenAI quota or sign photo
-- URLs (supabase/functions/_shared/http.ts). Keys hold an HMAC of the IP, never the
-- raw address, and rows older than a day are pruned.
CREATE TABLE IF NOT EXISTS loot_goose_rate_limits (
  key          text        NOT NULL,
  window_start timestamptz NOT NULL,
  hits         integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

ALTER TABLE loot_goose_rate_limits ENABLE ROW LEVEL SECURITY;

-- Counts one call and returns true while the key is still within p_limit calls
-- for the current fixed window of p_window_seconds.
CREATE OR REPLACE FUNCTION loot_goose_rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_window timestamptz := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
BEGIN
  INSERT INTO loot_goose_rate_limits AS r (key, window_start, hits)
  VALUES (p_key, v_window, 1)
  ON CONFLICT (key, window_start) DO UPDATE SET hits = r.hits + 1
  RETURNING hits INTO v_hits;

  IF random() < 0.01 THEN
    DELETE FROM loot_goose_rate_limits WHERE window_start < now() - interval '1 day';
  END IF;

  RETURN v_hits <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION loot_goose_rate_limit_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION loot_goose_rate_limit_hit(text, integer, integer) TO service_role;
