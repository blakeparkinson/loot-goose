import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Hunt, HuntItem } from './types';

const HUNTS_KEY = 'lootgoose_hunts';

interface AppStore {
  hunts: Hunt[];
  loadHunts: () => Promise<void>;
  saveHunt: (hunt: Hunt) => Promise<void>;
  deleteHunt: (huntId: string) => Promise<void>;
  completeItem: (huntId: string, itemId: string, photoUri: string, verificationNote: string) => Promise<void>;
  getHunt: (huntId: string) => Hunt | undefined;
}

export const useAppStore = create<AppStore>((set, get) => ({
  hunts: [],

  loadHunts: async () => {
    try {
      const raw = await AsyncStorage.getItem(HUNTS_KEY);
      if (raw) set({ hunts: JSON.parse(raw) });
    } catch (e) {
      console.error('Failed to load hunts:', e);
    }
  },

  saveHunt: async (hunt: Hunt) => {
    const { hunts } = get();
    const exists = hunts.some((h) => h.id === hunt.id);
    const updated = exists
      ? hunts.map((h) => (h.id === hunt.id ? hunt : h))
      : [hunt, ...hunts];
    set({ hunts: updated });
    try {
      await AsyncStorage.setItem(HUNTS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to persist hunts:', e);
    }
  },

  deleteHunt: async (huntId: string) => {
    const { hunts } = get();
    const updated = hunts.filter((h) => h.id !== huntId);
    set({ hunts: updated });
    try {
      await AsyncStorage.setItem(HUNTS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to delete hunt:', e);
    }
  },

  completeItem: async (huntId, itemId, photoUri, verificationNote) => {
    const { hunts, saveHunt } = get();
    const hunt = hunts.find((h) => h.id === huntId);
    if (!hunt) return;

    const item = hunt.items.find((i) => i.id === itemId);
    if (!item || item.completed) return;

    const updatedItems: HuntItem[] = hunt.items.map((i) =>
      i.id === itemId
        ? { ...i, completed: true, photoUri, verificationNote, completedAt: new Date().toISOString() }
        : i
    );
    const earnedPoints = updatedItems.filter((i) => i.completed).reduce((sum, i) => sum + i.points, 0);
    const allDone = updatedItems.every((i) => i.completed);

    await saveHunt({
      ...hunt,
      items: updatedItems,
      earnedPoints,
      completedAt: allDone ? new Date().toISOString() : undefined,
    });
  },

  getHunt: (huntId) => get().hunts.find((h) => h.id === huntId),
}));
