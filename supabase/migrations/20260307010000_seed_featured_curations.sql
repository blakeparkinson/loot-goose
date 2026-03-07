INSERT INTO library_curations (
  slot,
  action_type,
  hunt_code,
  title,
  subtitle,
  badge_text,
  sort_order
)
SELECT
  'featured',
  'hunt',
  ranked.code,
  ranked.title,
  CONCAT(ranked.item_count, ' stops in ', ranked.location),
  'Featured',
  ranked.row_num - 1
FROM (
  SELECT
    code,
    title,
    location,
    item_count,
    ROW_NUMBER() OVER (ORDER BY plays DESC, created_at DESC) AS row_num
  FROM public_hunts
) AS ranked
WHERE ranked.row_num <= 3
  AND NOT EXISTS (
    SELECT 1 FROM library_curations WHERE slot = 'featured'
  );
