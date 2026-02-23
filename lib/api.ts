import { Hunt, HuntDifficulty, HuntItem } from './types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const POINT_RANGE: Record<HuntDifficulty, [number, number]> = {
  easy: [10, 20],
  medium: [15, 40],
  hard: [20, 60],
};

async function callEdgeFunction(fnName: string, body: object, timeoutMs = 40000) {
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
      throw new Error(text || `Request failed with status ${res.status}`);
    }
    return res.json();
  } catch (e: any) {
    if (e.name === 'AbortError') {
      throw new Error('Request timed out. The server may be warming up — please try again.');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
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

  const items: HuntItem[] = (data.items as any[]).map((item, i) => ({
    id: `item-${Date.now()}-${i}`,
    name: item.name,
    description: item.description,
    hint: item.hint,
    points: item.points,
    completed: false,
    sublocation: item.sublocation,
    geocodeQuery: item.geocodeQuery,
    coords: item.coords
      ? { latitude: item.coords.lat, longitude: item.coords.lon }
      : undefined,
  }));

  return {
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
  };
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
  customPrompt?: string;
}): Promise<HuntItem> {
  const { location, prompt, difficulty, existingItemNames, beforeStop, afterStop, customPrompt } = params;
  const [minPts, maxPts] = POINT_RANGE[difficulty];

  const data = await callEdgeFunction('insert-item', {
    location, prompt, minPts, maxPts, existingItemNames, beforeStop, afterStop, customPrompt,
  });

  return {
    id: `item-${Date.now()}-insert`,
    name: data.name,
    description: data.description,
    hint: data.hint,
    points: data.points,
    completed: false,
    sublocation: data.sublocation,
    geocodeQuery: data.geocodeQuery,
  };
}

export async function swapItem(params: {
  location: string;
  prompt: string;
  difficulty: HuntDifficulty;
  existingItemNames: string[];
  customPrompt?: string;
}): Promise<HuntItem> {
  const { location, prompt, difficulty, existingItemNames, customPrompt } = params;
  const [minPts, maxPts] = POINT_RANGE[difficulty];

  const data = await callEdgeFunction('swap-item', { location, prompt, minPts, maxPts, existingItemNames, customPrompt });

  return {
    id: `item-${Date.now()}-swap`,
    name: data.name,
    description: data.description,
    hint: data.hint,
    points: data.points,
    completed: false,
    sublocation: data.sublocation,
    geocodeQuery: data.geocodeQuery,
  };
}
