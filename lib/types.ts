export type HuntDifficulty = 'easy' | 'medium' | 'hard';

export interface Coords {
  latitude: number;
  longitude: number;
}

export interface HuntItem {
  id: string;
  name: string;
  description: string;
  hint: string;
  points: number;
  completed: boolean;
  photoUri?: string;
  completedAt?: string;
  verificationNote?: string;
  sublocation?: string;    // e.g. "near the Bethesda Fountain"
  geocodeQuery?: string;   // precise query for Nominatim
  coords?: Coords;         // populated lazily on navigate tap
}

export interface Hunt {
  id: string;
  title: string;
  location: string;
  coords?: Coords;         // geocoded center of the hunt area
  prompt: string;
  difficulty: HuntDifficulty;
  items: HuntItem[];
  totalPoints: number;
  earnedPoints: number;
  createdAt: string;
  completedAt?: string;
}
