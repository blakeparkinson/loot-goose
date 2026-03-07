import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Hunt, HuntItem, Coords } from './types';
import { enrichHuntMetadata } from './huntInsights';

const HUNTS_KEY = 'lootgoose_hunts';

function earnedPointsFor(items: HuntItem[]): number {
  return items.filter((i) => i.completed).reduce((sum, i) => sum + i.points, 0);
}

interface AppStore {
  hunts: Hunt[];
  loadHunts: () => Promise<void>;
  saveHunt: (hunt: Hunt) => Promise<void>;
  deleteHunt: (huntId: string) => Promise<void>;
  completeItem: (huntId: string, itemId: string, photoUri: string, verificationNote: string) => Promise<void>;
  updateItemCoords: (huntId: string, itemId: string, coords: Coords) => Promise<void>;
  replaceItem: (huntId: string, itemId: string, newItem: HuntItem) => Promise<void>;
  insertItemAfter: (huntId: string, afterItemId: string, newItem: HuntItem) => Promise<void>;
  deleteItem: (huntId: string, itemId: string) => Promise<void>;
  replaceIncompleteItems: (huntId: string, newItems: HuntItem[]) => Promise<void>;
  getHunt: (huntId: string) => Hunt | undefined;
}

export const useAppStore = create<AppStore>((set, get) => ({
  hunts: [],

  loadHunts: async () => {
    try {
      const raw = await AsyncStorage.getItem(HUNTS_KEY);
      if (raw) {
        const hunts = (JSON.parse(raw) as Hunt[]).map((hunt) => enrichHuntMetadata(hunt));
        set({ hunts });
      }
    } catch (e) {
      console.error('Failed to load hunts:', e);
    }
  },

  saveHunt: async (hunt: Hunt) => {
    const { hunts } = get();
    const enriched = enrichHuntMetadata(hunt);
    const exists = hunts.some((h) => h.id === enriched.id);
    const updated = exists
      ? hunts.map((h) => (h.id === enriched.id ? enriched : h))
      : [enriched, ...hunts];
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

    const now = new Date().toISOString();
    const isFirst = !hunt.items.some((i) => i.completed);
    const updatedItems: HuntItem[] = hunt.items.map((i) =>
      i.id === itemId
        ? { ...i, completed: true, photoUri, verificationNote, completedAt: now }
        : i
    );
    const allDone = updatedItems.every((i) => i.completed);

    await saveHunt({
      ...hunt,
      items: updatedItems,
      earnedPoints: earnedPointsFor(updatedItems),
      startedAt: hunt.startedAt ?? (isFirst ? now : undefined),
      completedAt: allDone ? now : undefined,
    });
  },

  updateItemCoords: async (huntId, itemId, coords) => {
    const { hunts, saveHunt } = get();
    const hunt = hunts.find((h) => h.id === huntId);
    if (!hunt) return;
    await saveHunt({
      ...hunt,
      items: hunt.items.map((i) => (i.id === itemId ? { ...i, coords } : i)),
    });
  },

  replaceItem: async (huntId, itemId, newItem) => {
    const { hunts, saveHunt } = get();
    const hunt = hunts.find((h) => h.id === huntId);
    if (!hunt) return;
    const updatedItems = hunt.items.map((i) => (i.id === itemId ? newItem : i));
    await saveHunt({
      ...hunt,
      items: updatedItems,
      totalPoints: updatedItems.reduce((sum, i) => sum + i.points, 0),
      earnedPoints: earnedPointsFor(updatedItems),
    });
  },

  insertItemAfter: async (huntId, afterItemId, newItem) => {
    const { hunts, saveHunt } = get();
    const hunt = hunts.find((h) => h.id === huntId);
    if (!hunt) return;
    const afterIndex = hunt.items.findIndex((i) => i.id === afterItemId);
    const updatedItems = [...hunt.items];
    updatedItems.splice(afterIndex + 1, 0, newItem);
    await saveHunt({
      ...hunt,
      items: updatedItems,
      totalPoints: updatedItems.reduce((sum, i) => sum + i.points, 0),
      earnedPoints: earnedPointsFor(updatedItems),
    });
  },

  deleteItem: async (huntId, itemId) => {
    const { hunts, saveHunt } = get();
    const hunt = hunts.find((h) => h.id === huntId);
    if (!hunt) return;
    const updatedItems = hunt.items.filter((i) => i.id !== itemId);
    await saveHunt({
      ...hunt,
      items: updatedItems,
      totalPoints: updatedItems.reduce((sum, i) => sum + i.points, 0),
      earnedPoints: earnedPointsFor(updatedItems),
    });
  },

  replaceIncompleteItems: async (huntId, newItems) => {
    const { hunts, saveHunt } = get();
    const hunt = hunts.find((h) => h.id === huntId);
    if (!hunt) return;
    const completed = hunt.items.filter((i) => i.completed);
    const updatedItems = [...completed, ...newItems];
    await saveHunt({
      ...hunt,
      items: updatedItems,
      totalPoints: updatedItems.reduce((sum, i) => sum + i.points, 0),
      earnedPoints: earnedPointsFor(updatedItems),
    });
  },

  getHunt: (huntId) => get().hunts.find((h) => h.id === huntId),
}));
