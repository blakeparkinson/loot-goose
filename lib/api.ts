import { Hunt, HuntDifficulty, HuntItem } from './types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const ITEM_COUNT: Record<HuntDifficulty, number> = {
  easy: 5,
  medium: 8,
  hard: 12,
};

const POINT_RANGE: Record<HuntDifficulty, [number, number]> = {
  easy: [10, 20],
  medium: [15, 40],
  hard: [20, 60],
};

async function callEdgeFunction(fnName: string, body: object) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Edge function ${fnName} failed with ${res.status}`);
  }
  return res.json();
}

export async function generateHunt(params: {
  location: string;
  prompt: string;
  difficulty: HuntDifficulty;
}): Promise<Hunt> {
  const { location, prompt, difficulty } = params;
  const count = ITEM_COUNT[difficulty];
  const [minPts, maxPts] = POINT_RANGE[difficulty];

  const data = await callEdgeFunction('generate-hunt', {
    location,
    prompt,
    count,
    minPts,
    maxPts,
  });

  const items: HuntItem[] = (data.items as any[]).map((item, i) => ({
    id: `item-${Date.now()}-${i}`,
    name: item.name,
    description: item.description,
    hint: item.hint,
    points: item.points,
    completed: false,
  }));

  const totalPoints = items.reduce((sum, i) => sum + i.points, 0);

  const hunt: Hunt = {
    id: `hunt-${Date.now()}`,
    title: data.title,
    location,
    prompt,
    difficulty,
    items,
    totalPoints,
    earnedPoints: 0,
    createdAt: new Date().toISOString(),
  };

  return hunt;
}

export async function verifyPhoto(params: {
  imageBase64: string;
  itemName: string;
  itemDescription: string;
  location: string;
}): Promise<{ success: boolean; message: string }> {
  return callEdgeFunction('verify-item', params);
}
