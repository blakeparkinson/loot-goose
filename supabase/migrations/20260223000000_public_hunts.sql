CREATE TABLE IF NOT EXISTS public_hunts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text UNIQUE NOT NULL,
  hunt_data    jsonb NOT NULL,
  title        text NOT NULL,
  location     text NOT NULL,
  difficulty   text NOT NULL,
  total_points integer NOT NULL,
  item_count   integer NOT NULL,
  plays        integer DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS public_hunts_plays_idx ON public_hunts (plays DESC);
CREATE INDEX IF NOT EXISTS public_hunts_location_idx ON public_hunts (lower(location));
