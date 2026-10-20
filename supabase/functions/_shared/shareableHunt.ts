// Whatever the client sends, only these fields of a hunt are stored for publish,
// share and co-op. Photos, the AI's notes on them, completion times and the hunt's
// centre point (for Goose Loose hunts that is the player's own GPS fix) are dropped.
// Stop coordinates stay: they are geocoded public places the map needs.
// Keep in sync with toShareableHunt in lib/api.ts.

const HUNT_FIELDS = [
  'id', 'title', 'location', 'prompt', 'difficulty', 'totalPoints', 'earnedPoints', 'createdAt',
  'tags', 'swappedItemNames', 'routeMetrics', 'source', 'challengeBadge',
] as const;

const ITEM_FIELDS = [
  'id', 'name', 'description', 'hint', 'lore', 'points', 'completed', 'sublocation',
  'geocodeQuery', 'aiConfidence', 'confidenceNote',
] as const;

function pick(source: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (source[field] !== undefined) out[field] = source[field];
  }
  return out;
}

function stopCoords(value: unknown): { latitude: number; longitude: number } | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const { latitude, longitude } = value as Record<string, unknown>;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return undefined;
  return { latitude, longitude };
}

/** Returns null when the payload isn't a hunt object. */
// deno-lint-ignore no-explicit-any
export function toShareableHunt(huntData: unknown): Record<string, any> | null {
  if (!huntData || typeof huntData !== 'object' || Array.isArray(huntData)) return null;
  const hunt = huntData as Record<string, unknown>;
  const items = Array.isArray(hunt.items) ? hunt.items : [];
  return {
    ...pick(hunt, HUNT_FIELDS),
    items: items
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => {
        const coords = stopCoords(item.coords);
        return { ...pick(item, ITEM_FIELDS), ...(coords ? { coords } : {}) };
      }),
  };
}
