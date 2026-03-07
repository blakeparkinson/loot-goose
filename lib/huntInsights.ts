import { Coords, ConfidenceLevel, Hunt, HuntItem, RouteMetrics } from './types';

const MAX_ROUTE_WAYPOINTS = 8;

function haversineMi(a: Coords, b: Coords): number {
  const R = 3958.8;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(x));
}

export function estimateStopConfidence(item: Pick<HuntItem, 'coords' | 'geocodeQuery' | 'sublocation' | 'name'>): {
  level: ConfidenceLevel;
  note: string;
} {
  const hasCoords = !!item.coords;
  const hasPreciseQuery = typeof item.geocodeQuery === 'string' && item.geocodeQuery.split(',').length >= 3;
  const hasVenueAndArea = typeof item.sublocation === 'string' && item.sublocation.includes('·');

  if (hasCoords && hasPreciseQuery && hasVenueAndArea) {
    return { level: 'high', note: 'Mapped cleanly with strong venue details.' };
  }
  if ((hasCoords && hasVenueAndArea) || (hasCoords && hasPreciseQuery)) {
    return { level: 'medium', note: 'Looks usable, but the stop metadata is only partially specific.' };
  }
  return { level: 'low', note: 'Needs a better map query or location details.' };
}

export function buildRouteExportPreview(
  origin: Coords | null,
  stops: Array<{ coords?: Coords; query?: string }>,
): {
  routeStops: Array<{ coords?: Coords; query?: string }>;
  omittedCount: number;
  maxWaypoints: number;
  hasFullRoute: boolean;
  origin: Coords | null;
} {
  const valid = stops.filter((s) => s.coords || s.query);
  if (valid.length <= MAX_ROUTE_WAYPOINTS + 1) {
    return {
      routeStops: valid,
      omittedCount: 0,
      maxWaypoints: MAX_ROUTE_WAYPOINTS,
      hasFullRoute: true,
      origin,
    };
  }

  const middle = valid.slice(1, -1);
  const step = (middle.length - 1) / (MAX_ROUTE_WAYPOINTS - 1);
  const kept = Array.from({ length: MAX_ROUTE_WAYPOINTS - 1 }, (_, i) => middle[Math.round(i * step)]);
  const routeStops = [valid[0], ...kept, valid[valid.length - 1]];

  return {
    routeStops,
    omittedCount: valid.length - routeStops.length,
    maxWaypoints: MAX_ROUTE_WAYPOINTS,
    hasFullRoute: false,
    origin,
  };
}

export function deriveHuntTags(hunt: Pick<Hunt, 'title' | 'prompt' | 'items'>): string[] {
  const haystack = `${hunt.title} ${hunt.prompt} ${hunt.items.map((item) => item.name).join(' ')}`.toLowerCase();
  const tags: string[] = [];

  const matches: Array<[string, RegExp]> = [
    ['history', /\b(history|historic|old|museum|heritage)\b/],
    ['art', /\b(art|mural|gallery|street art|graffiti)\b/],
    ['food', /\b(food|coffee|cafe|bakery|restaurant|bar|drink)\b/],
    ['nature', /\b(nature|park|garden|tree|river|waterfront|outdoor)\b/],
    ['weird', /\b(weird|funny|chaos|bizarre|odd|face)\b/],
    ['local', /\b(local|hidden gem|neighborhood|locals)\b/],
    ['architecture', /\b(building|architecture|design|plaza)\b/],
    ['family', /\b(family|kid|playground)\b/],
    ['dog-friendly', /\b(dog|dog-friendly|puppy)\b/],
  ];

  for (const [tag, regex] of matches) {
    if (regex.test(haystack)) tags.push(tag);
  }

  return tags.slice(0, 4);
}

export function calculateRouteMetrics(hunt: Pick<Hunt, 'coords' | 'items'>): RouteMetrics {
  const coords = hunt.items.map((item) => item.coords).filter((coord): coord is Coords => !!coord);
  let estimatedDistanceMiles: number | undefined;

  if (coords.length >= 2) {
    estimatedDistanceMiles = 0;
    for (let i = 1; i < coords.length; i++) {
      estimatedDistanceMiles += haversineMi(coords[i - 1], coords[i]);
    }
  }

  const exportPreview = buildRouteExportPreview(
    hunt.coords ?? null,
    hunt.items.map((item) => ({ coords: item.coords, query: item.geocodeQuery ?? item.sublocation ?? item.name })),
  );

  const lowConfidenceStops = hunt.items.filter((item) => estimateStopConfidence(item).level === 'low').length;
  const warnings: string[] = [];

  if (coords.length < hunt.items.length) {
    warnings.push(`${hunt.items.length - coords.length} stop${hunt.items.length - coords.length === 1 ? '' : 's'} still need map coordinates.`);
  }
  if (exportPreview.omittedCount > 0) {
    warnings.push(`${exportPreview.omittedCount} stop${exportPreview.omittedCount === 1 ? '' : 's'} will be skipped when exporting the full route to maps.`);
  }
  if (typeof estimatedDistanceMiles === 'number' && estimatedDistanceMiles > 4.5) {
    warnings.push('This route is getting long for a casual walking hunt.');
  }
  if (lowConfidenceStops > 0) {
    warnings.push(`${lowConfidenceStops} stop${lowConfidenceStops === 1 ? '' : 's'} look low-confidence and may need a reroll.`);
  }

  return {
    estimatedDistanceMiles,
    geocodedStopCount: coords.length,
    totalStops: hunt.items.length,
    omittedFromMapExport: exportPreview.omittedCount,
    lowConfidenceStops,
    warnings,
  };
}

export function enrichHuntMetadata<T extends Hunt>(hunt: T): T {
  const items = hunt.items.map((item) => {
    const confidence = estimateStopConfidence(item);
    return {
      ...item,
      lore: item.lore ?? item.hint,
      aiConfidence: item.aiConfidence ?? confidence.level,
      confidenceNote: item.confidenceNote ?? confidence.note,
    };
  });

  return {
    ...hunt,
    items,
    tags: hunt.tags?.length ? hunt.tags : deriveHuntTags({ title: hunt.title, prompt: hunt.prompt, items }),
    routeMetrics: calculateRouteMetrics({ coords: hunt.coords, items }),
  };
}
