import { HighlightType, Hunt, HuntDifficulty, HuntItem, QuickPreset } from './types';
import { enrichHuntMetadata, estimateStopConfidence } from './huntInsights';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Upload a hunt photo to Supabase Storage and return the public URL.
 * Falls back to the local URI if the upload fails (offline, etc.).
 */
export async function uploadHuntPhoto(base64: string, huntId: string, itemId: string): Promise<string> {
  try {
    const path = `${huntId}/${itemId}-${Date.now()}.jpg`;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/hunt-photos/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'image/jpeg',
      },
      body: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return `${SUPABASE_URL}/storage/v1/object/public/hunt-photos/${path}`;
  } catch (e) {
    if (__DEV__) console.warn('[uploadHuntPhoto] failed, using local URI', e);
    throw e;
  }
}

const POINT_RANGE: Record<HuntDifficulty, [number, number]> = {
  easy: [10, 20],
  medium: [15, 40],
  hard: [20, 60],
};

const RETRYABLE_STATUSES = new Set([502, 503, 504]);

async function callEdgeFunctionOnce(fnName: string, body: object, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      const err = new Error(text || `Request failed with status ${res.status}`);
      (err as any).status = res.status;
      throw err;
    }
    try {
      return await res.json();
    } catch {
      throw new Error('Server returned invalid JSON. Please try again.');
    }
  } catch (e: any) {
    if (e.name === 'AbortError') {
      throw new Error('Request timed out. The server may be warming up — please try again.');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function callEdgeFunction(fnName: string, body: object, timeoutMs = 40000) {
  try {
    return await callEdgeFunctionOnce(fnName, body, timeoutMs);
  } catch (e: any) {
    const isRetryable = e.name === 'TypeError' || // network error
      RETRYABLE_STATUSES.has(e.status) ||
      e.message?.includes('timed out');
    if (!isRetryable) throw e;
    await new Promise((r) => setTimeout(r, 1000));
    return callEdgeFunctionOnce(fnName, body, timeoutMs);
  }
}

function toClientItem(item: any, id: string): HuntItem {
  const mapped: HuntItem = {
    id,
    name: item.name,
    description: item.description,
    hint: item.hint ?? '',
    lore: item.lore,
    points: item.points,
    completed: false,
    sublocation: item.sublocation,
    geocodeQuery: item.geocodeQuery,
    coords: item.coords
      ? { latitude: item.coords.lat, longitude: item.coords.lon }
      : undefined,
  };
  const confidence = estimateStopConfidence(mapped);
  return { ...mapped, aiConfidence: confidence.level, confidenceNote: confidence.note };
}

export function clonePlayableHunt(huntData: Hunt, source: Hunt['source'] = 'library'): Hunt {
  return enrichHuntMetadata({
    ...huntData,
    source,
    id: `hunt-${Date.now()}`,
    createdAt: new Date().toISOString(),
    earnedPoints: 0,
    startedAt: undefined,
    completedAt: undefined,
    items: huntData.items.map((item, i) => ({
      ...item,
      id: `item-${Date.now()}-${i}`,
      completed: false,
      photoUri: undefined,
      completedAt: undefined,
      verificationNote: undefined,
    })),
  });
}

export async function generateHunt(params: {
  location: string;
  prompt: string;
  difficulty: HuntDifficulty;
  count: number;
  weather?: string;
}): Promise<Hunt> {
  const { location, prompt, difficulty, count, weather } = params;
  const [minPts, maxPts] = POINT_RANGE[difficulty];

  const data = await callEdgeFunction('generate-hunt', {
    location,
    prompt,
    count,
    minPts,
    maxPts,
    weather,
  });

  const items: HuntItem[] = (data.items as any[]).map((item, i) => toClientItem(item, `item-${Date.now()}-${i}`));

  return enrichHuntMetadata({
    id: `hunt-${Date.now()}`,
    title: data.title,
    location,
    coords: data.huntCoords
      ? { latitude: data.huntCoords.lat, longitude: data.huntCoords.lon }
      : undefined,
    prompt,
    difficulty,
    items,
    totalPoints: items.reduce((sum, i) => sum + i.points, 0),
    earnedPoints: 0,
    createdAt: new Date().toISOString(),
  });
}

export async function verifyPhoto(params: {
  imageBase64: string;
  itemName: string;
  itemDescription: string;
  location: string;
}): Promise<{ success: boolean; message: string }> {
  return callEdgeFunction('verify-item', params);
}

export async function insertItem(params: {
  location: string;
  prompt: string;
  difficulty: HuntDifficulty;
  existingItemNames: string[];
  beforeStop: string;
  afterStop: string;
  huntCoords?: { latitude: number; longitude: number };
  customPrompt?: string;
}): Promise<HuntItem> {
  const { location, prompt, difficulty, existingItemNames, beforeStop, afterStop, huntCoords, customPrompt } = params;
  const [minPts, maxPts] = POINT_RANGE[difficulty];

  const data = await callEdgeFunction('insert-item', {
    location, prompt, minPts, maxPts, existingItemNames, beforeStop, afterStop, customPrompt,
    huntCoords: huntCoords ? { lat: huntCoords.latitude, lon: huntCoords.longitude } : undefined,
  });

  return toClientItem(data, `item-${Date.now()}-insert`);
}

export async function tuneHunt(params: {
  location: string;
  prompt: string;
  difficulty: HuntDifficulty;
  feedback: string;
  currentStops: {
    name: string;
    sublocation?: string;
    geocodeQuery?: string;
    completed: boolean;
    coords?: { latitude: number; longitude: number };
    aiConfidence?: string;
  }[];
  incompleteCount: number;
}): Promise<HuntItem[]> {
  const { location, prompt, difficulty, feedback, currentStops, incompleteCount } = params;
  const [minPts, maxPts] = POINT_RANGE[difficulty];

  const data = await callEdgeFunction('tune-hunt', {
    location, prompt, minPts, maxPts, feedback, currentStops, incompleteCount,
  });

  return (data.items as any[]).map((item, i) => toClientItem(item, `item-${Date.now()}-tune-${i}`));
}

// --- Co-op ---

export interface CoopCompletion {
  id: string;
  session_code: string;
  item_id: string;
  player_name: string;
  verification_note: string | null;
  completed_at: string;
}

export interface CoopSessionInfo {
  huntData: Hunt;
  completions: CoopCompletion[];
  players: { name: string; joinedAt: string }[];
  playerName: string;
}

export async function createCoopSession(huntData: Hunt, playerName: string): Promise<{ code: string; playerName: string }> {
  return callEdgeFunction('create-coop-session', { huntData, playerName }, 15000);
}

export async function joinCoopSession(code: string, playerName: string): Promise<CoopSessionInfo> {
  const data = await callEdgeFunction('join-coop-session', { code, playerName }, 15000);
  return {
    ...data,
    huntData: enrichHuntMetadata(data.huntData),
  };
}

export async function completeCoopItem(params: {
  code: string;
  itemId: string;
  playerName: string;
  verificationNote: string;
}): Promise<{ ok: boolean; alreadyCompleted?: boolean }> {
  return callEdgeFunction('complete-coop-item', params, 20000);
}

export async function loadSharedHunt(code: string): Promise<Hunt> {
  return enrichHuntMetadata(await callEdgeFunction('load-hunt', { code }, 15000));
}

export async function swapItem(params: {
  location: string;
  prompt: string;
  difficulty: HuntDifficulty;
  existingItemNames: string[];
  huntCoords?: { latitude: number; longitude: number };
  customPrompt?: string;
}): Promise<HuntItem> {
  const { location, prompt, difficulty, existingItemNames, huntCoords, customPrompt } = params;
  const [minPts, maxPts] = POINT_RANGE[difficulty];

  const data = await callEdgeFunction('swap-item', {
    location, prompt, minPts, maxPts, existingItemNames, customPrompt,
    huntCoords: huntCoords ? { lat: huntCoords.latitude, lon: huntCoords.longitude } : undefined,
  });

  return toClientItem(data, `item-${Date.now()}-swap`);
}

// --- Library ---

export interface LibraryHunt {
  id: string;
  code: string;
  title: string;
  location: string;
  difficulty: HuntDifficulty;
  totalPoints: number;
  itemCount: number;
  plays: number;
  createdAt: string;
  tags: string[];
  routeDistanceMiles?: number;
  highlightTitle?: string;
  highlightSubtitle?: string;
  highlightBadge?: string;
  preset?: QuickPreset;
  type?: HighlightType;
}

export interface WeeklyChallenge {
  type: HighlightType;
  title: string;
  subtitle?: string;
  badge?: string;
  preset?: QuickPreset;
  id?: string;
  code?: string;
  location?: string;
  difficulty?: HuntDifficulty;
  totalPoints?: number;
  itemCount?: number;
  plays?: number;
  createdAt?: string;
  tags?: string[];
  routeDistanceMiles?: number;
}

export interface LibraryHighlights {
  weeklyChallenge: WeeklyChallenge | null;
  featured: LibraryHunt[];
}

export async function publishHunt(hunt: Hunt): Promise<{ code: string }> {
  return callEdgeFunction('publish-hunt', { huntData: hunt }, 15000);
}

export async function browseHunts(query: string): Promise<LibraryHunt[]> {
  const rows: any[] = await callEdgeFunction('browse-hunts', { query: query.trim(), limit: 30 }, 10000);
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    location: r.location,
    difficulty: r.difficulty as HuntDifficulty,
    totalPoints: r.total_points,
    itemCount: r.item_count,
    plays: r.plays,
    createdAt: r.created_at,
    tags: Array.isArray(r.tags) ? r.tags : [],
    routeDistanceMiles: typeof r.route_distance_miles === 'number' ? r.route_distance_miles : undefined,
    highlightTitle: r.highlight_title,
    highlightSubtitle: r.highlight_subtitle,
    highlightBadge: r.highlight_badge,
    preset: r.preset_data,
    type: r.type,
  }));
}

export async function loadLibraryHunt(code: string): Promise<Hunt> {
  return enrichHuntMetadata(await callEdgeFunction('load-library-hunt', { code }, 15000));
}

export async function loadLibraryHighlights(): Promise<LibraryHighlights> {
  const data = await callEdgeFunction('library-highlights', {}, 10000);
  return {
    weeklyChallenge: data.weeklyChallenge
      ? {
          ...data.weeklyChallenge,
          difficulty: data.weeklyChallenge.difficulty as HuntDifficulty | undefined,
          tags: Array.isArray(data.weeklyChallenge.tags) ? data.weeklyChallenge.tags : [],
          routeDistanceMiles:
            typeof data.weeklyChallenge.route_distance_miles === 'number'
              ? data.weeklyChallenge.route_distance_miles
              : undefined,
          createdAt: data.weeklyChallenge.created_at,
          itemCount: data.weeklyChallenge.item_count,
          totalPoints: data.weeklyChallenge.total_points,
        }
      : null,
    featured: Array.isArray(data.featured)
      ? data.featured.map((r: any) => ({
          id: r.id,
          code: r.code,
          title: r.title,
          location: r.location,
          difficulty: r.difficulty as HuntDifficulty,
          totalPoints: r.total_points ?? 0,
          itemCount: r.item_count ?? 0,
          plays: r.plays ?? 0,
          createdAt: r.created_at,
          tags: Array.isArray(r.tags) ? r.tags : [],
          routeDistanceMiles: typeof r.route_distance_miles === 'number' ? r.route_distance_miles : undefined,
          highlightTitle: r.highlight_title,
          highlightSubtitle: r.highlight_subtitle,
          highlightBadge: r.highlight_badge,
          preset: r.preset_data,
          type: r.preset_data ? 'preset' : 'hunt',
        }))
      : [],
  };
}
