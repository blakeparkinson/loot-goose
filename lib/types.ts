export type HuntDifficulty = 'easy' | 'medium' | 'hard';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type HighlightType = 'hunt' | 'preset';

export interface Coords {
  latitude: number;
  longitude: number;
}

export interface RouteMetrics {
  estimatedDistanceMiles?: number;
  geocodedStopCount: number;
  totalStops: number;
  omittedFromMapExport: number;
  lowConfidenceStops: number;
  warnings: string[];
}

export interface QuickPreset {
  title: string;
  prompt: string;
  difficulty: HuntDifficulty;
  stopCount: number;
  suggestions?: string[];
  subtitle?: string;
  location?: string;
}

export interface HuntItem {
  id: string;
  name: string;
  description: string;
  hint?: string;           // legacy field; old hunts may still have this text
  lore?: string;           // summary/history text shown in the UI
  points: number;
  completed: boolean;
  photoUri?: string;
  completedAt?: string;
  verificationNote?: string;
  sublocation?: string;    // e.g. "near the Bethesda Fountain"
  geocodeQuery?: string;   // precise query for Nominatim
  coords?: Coords;         // populated lazily on navigate tap
  aiConfidence?: ConfidenceLevel;
  confidenceNote?: string;
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
  startedAt?: string;    // set on first item completion
  completedAt?: string;
  publishedCode?: string;  // set once published to library; re-publish shows existing code
  tags?: string[];
  swappedItemNames?: string[];
  routeMetrics?: RouteMetrics;
  source?: 'generated' | 'library' | 'challenge' | 'goose_loose';
  challengeBadge?: string;
}
