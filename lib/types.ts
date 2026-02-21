export type HuntDifficulty = 'easy' | 'medium' | 'hard';

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
}

export interface Hunt {
  id: string;
  title: string;
  location: string;
  prompt: string;
  difficulty: HuntDifficulty;
  items: HuntItem[];
  totalPoints: number;
  earnedPoints: number;
  createdAt: string;
  completedAt?: string;
}
