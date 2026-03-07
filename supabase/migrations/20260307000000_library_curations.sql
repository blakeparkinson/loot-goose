CREATE TABLE IF NOT EXISTS library_curations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot text NOT NULL CHECK (slot IN ('weekly_challenge', 'featured')),
  action_type text NOT NULL CHECK (action_type IN ('hunt', 'preset')),
  hunt_code text REFERENCES public_hunts(code) ON DELETE CASCADE,
  title text NOT NULL,
  subtitle text,
  badge_text text,
  preset_data jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT library_curations_target_check CHECK (
    (action_type = 'hunt' AND hunt_code IS NOT NULL AND preset_data IS NULL)
    OR
    (action_type = 'preset' AND hunt_code IS NULL AND preset_data IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS library_curations_slot_idx
  ON library_curations (slot, starts_at DESC, sort_order ASC);

CREATE INDEX IF NOT EXISTS library_curations_active_idx
  ON library_curations (starts_at, ends_at);

INSERT INTO library_curations (
  slot,
  action_type,
  title,
  subtitle,
  badge_text,
  preset_data,
  sort_order
)
SELECT
  'weekly_challenge',
  'preset',
  'Weekly Challenge',
  'Find the oddest local details on a short route.',
  'This Week',
  jsonb_build_object(
    'title', 'Neighborhood Oddities',
    'prompt', 'Find weird signs, odd details, and little moments of neighborhood personality',
    'difficulty', 'medium',
    'stopCount', 5,
    'suggestions', jsonb_build_array('Weird or funny signs', 'Hidden gems only locals know')
  ),
  0
WHERE NOT EXISTS (
  SELECT 1 FROM library_curations WHERE slot = 'weekly_challenge'
);
