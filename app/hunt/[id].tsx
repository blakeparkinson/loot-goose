import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/Colors';
import { useAppStore, hintPenalty } from '@/lib/store';
import { HuntItem } from '@/lib/types';
import { geocodeQuery } from '@/lib/geocoding';
import { openNativeMapsDirections, openMapsSearch } from '@/lib/navigation';
import { swapItem, insertItem } from '@/lib/api';

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: Colors.green,
  medium: Colors.gold,
  hard: Colors.red,
};

export default function HuntScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const hunt = useAppStore((s) => s.hunts.find((h) => h.id === id));
  const deleteHunt = useAppStore((s) => s.deleteHunt);
  const updateItemCoords = useAppStore((s) => s.updateItemCoords);
  const replaceItem = useAppStore((s) => s.replaceItem);
  const revealHint = useAppStore((s) => s.revealHint);
  const insertItemAfter = useAppStore((s) => s.insertItemAfter);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [swappingId, setSwappingId] = useState<string | null>(null);
  const [revealingHintId, setRevealingHintId] = useState<string | null>(null);
  const [insertingAfterId, setInsertingAfterId] = useState<string | null>(null);

  useEffect(() => {
    if (hunt) navigation.setOptions({ title: hunt.title });
  }, [hunt?.title]);

  if (!hunt) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: Colors.textSecondary }}>Hunt not found.</Text>
      </View>
    );
  }

  const completedCount = hunt.items.filter((i) => i.completed).length;
  const pct = hunt.items.length > 0 ? (completedCount / hunt.items.length) * 100 : 0;
  const diffColor = DIFFICULTY_COLOR[hunt.difficulty];

  const handleDelete = () => {
    Alert.alert('Delete Hunt', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteHunt(hunt.id);
          router.back();
        },
      },
    ]);
  };

  const handleNavigate = async (item: HuntItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNavigatingId(item.id);
    try {
      let coords = item.coords;
      if (!coords && item.geocodeQuery) {
        coords = (await geocodeQuery(item.geocodeQuery)) ?? undefined;
        if (coords) await updateItemCoords(hunt.id, item.id, coords);
      }
      if (coords) {
        await openNativeMapsDirections(coords);
      } else {
        await openMapsSearch(`${item.sublocation ?? item.name}, ${hunt.location}`);
      }
    } finally {
      setNavigatingId(null);
    }
  };

  const handleRevealHint = (item: HuntItem) => {
    const penalty = hintPenalty({ ...item, hintRevealed: true });
    Alert.alert(
      'Reveal Hint?',
      `Revealing the hint costs you ${penalty} pts at completion. Worth it?`,
      [
        { text: 'Keep it locked', style: 'cancel' },
        {
          text: `Reveal (−${penalty}pts)`,
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setRevealingHintId(item.id);
            try {
              await revealHint(hunt!.id, item.id);
            } finally {
              setRevealingHintId(null);
            }
          },
        },
      ],
    );
  };

  const handleInsert = (afterItem: HuntItem, beforeItem: HuntItem) => {
    Alert.alert(
      'Add a Stop?',
      `Add a new stop between "${afterItem.name}" and "${beforeItem.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add Stop',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setInsertingAfterId(afterItem.id);
            try {
              const newItem = await insertItem({
                location: hunt!.location,
                prompt: hunt!.prompt,
                difficulty: hunt!.difficulty,
                existingItemNames: hunt!.items.map((i) => i.name),
                beforeStop: afterItem.sublocation ?? afterItem.name,
                afterStop: beforeItem.sublocation ?? beforeItem.name,
              });
              await insertItemAfter(hunt!.id, afterItem.id, newItem);
            } catch (e: any) {
              Alert.alert('Failed', e.message ?? 'Could not generate a new stop.');
            } finally {
              setInsertingAfterId(null);
            }
          },
        },
      ],
    );
  };

  const handleSwap = (item: HuntItem) => {
    Alert.alert(
      'Swap Task?',
      `Replace "${item.name}" with a new one? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Swap It',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setSwappingId(item.id);
            try {
              const existingNames = hunt!.items
                .filter((i) => i.id !== item.id)
                .map((i) => i.name);
              const newItem = await swapItem({
                location: hunt!.location,
                prompt: hunt!.prompt,
                difficulty: hunt!.difficulty,
                existingItemNames: existingNames,
              });
              await replaceItem(hunt!.id, item.id, newItem);
            } catch (e: any) {
              Alert.alert('Swap Failed', e.message ?? 'Something went wrong.');
            } finally {
              setSwappingId(null);
            }
          },
        },
      ],
    );
  };

  // Build interleaved list: item rows + "+" separators between consecutive incomplete stops
  type ListRow =
    | { type: 'item'; item: HuntItem; index: number }
    | { type: 'insert'; afterItem: HuntItem; beforeItem: HuntItem; key: string };

  const listData: ListRow[] = [];
  hunt.items.forEach((item, i) => {
    listData.push({ type: 'item', item, index: i });
    const next = hunt.items[i + 1];
    if (next && !item.completed && !next.completed) {
      listData.push({ type: 'insert', afterItem: item, beforeItem: next, key: `insert-${item.id}-${next.id}` });
    }
  });

  const renderRow = ({ item: row }: { item: ListRow }) => {
    if (row.type === 'insert') {
      const isInserting = insertingAfterId === row.afterItem.id;
      return (
        <TouchableOpacity
          style={styles.insertRow}
          onPress={() => handleInsert(row.afterItem, row.beforeItem)}
          disabled={isInserting || insertingAfterId !== null}
          activeOpacity={0.7}
        >
          <View style={styles.insertLine} />
          {isInserting ? (
            <ActivityIndicator size="small" color={Colors.purple} style={styles.insertIcon} />
          ) : (
            <View style={styles.insertPill}>
              <FontAwesome name="plus" size={10} color={Colors.purple} />
              <Text style={styles.insertPillText}>Add stop</Text>
            </View>
          )}
          <View style={styles.insertLine} />
        </TouchableOpacity>
      );
    }

    const { item, index } = row;
    const isNavigating = navigatingId === item.id;
    const isSwapping = swappingId === item.id;
    const isRevealingHint = revealingHintId === item.id;
    const penalty = hintPenalty({ ...item, hintRevealed: true });
    return (
      <View style={[styles.itemCard, item.completed && styles.itemCardDone]}>
        <View style={styles.itemLeft}>
          <View style={[styles.itemNumber, item.completed && { backgroundColor: Colors.greenLight }]}>
            {item.completed ? (
              <FontAwesome name="check" size={14} color={Colors.green} />
            ) : (
              <Text style={styles.itemNumberText}>{index + 1}</Text>
            )}
          </View>
          <View style={styles.itemInfo}>
            <Text style={[styles.itemName, item.completed && { color: Colors.textSecondary, textDecorationLine: 'line-through' }]}>
              {item.name}
            </Text>
            <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
            {!item.completed && item.sublocation && (
              <Text style={styles.itemSublocation} numberOfLines={1}>
                <FontAwesome name="map-pin" size={11} color={Colors.blue} /> {item.sublocation}
              </Text>
            )}
            {!item.completed && (
              item.hintRevealed ? (
                <View style={styles.hintRow}>
                  <FontAwesome name="lightbulb-o" size={11} color={Colors.gold} />
                  <Text style={styles.itemHint} numberOfLines={2}>{item.hint}</Text>
                  <View style={styles.hintPenaltyBadge}>
                    <Text style={styles.hintPenaltyText}>−{penalty}pts</Text>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.hintLocked}
                  onPress={() => handleRevealHint(item)}
                  disabled={isRevealingHint}
                >
                  {isRevealingHint ? (
                    <ActivityIndicator size="small" color={Colors.gold} />
                  ) : (
                    <>
                      <FontAwesome name="lock" size={11} color={Colors.gold} />
                      <Text style={styles.hintLockedText}>Reveal hint · −{penalty}pts</Text>
                    </>
                  )}
                </TouchableOpacity>
              )
            )}
            {item.completed && item.verificationNote ? (
              <Text style={styles.verificationNote} numberOfLines={1}>
                <FontAwesome name="check-circle" size={11} color={Colors.green} /> {item.verificationNote}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.itemRight}>
          <Text style={[styles.itemPoints, { color: item.completed ? Colors.green : Colors.gold }]}>
            {item.completed ? item.points - hintPenalty(item) : item.points}pts
          </Text>
          {!item.completed && (
            <View style={styles.itemActions}>
              <TouchableOpacity
                style={styles.swapBtn}
                onPress={() => handleSwap(item)}
                disabled={isSwapping || swappingId !== null}
              >
                {isSwapping ? (
                  <ActivityIndicator size="small" color={Colors.textSecondary} />
                ) : (
                  <FontAwesome name="refresh" size={13} color={Colors.textSecondary} />
                )}
              </TouchableOpacity>
              {(item.sublocation || item.geocodeQuery) && (
                <TouchableOpacity
                  style={styles.navigateBtn}
                  onPress={() => handleNavigate(item)}
                  disabled={isNavigating}
                >
                  {isNavigating ? (
                    <ActivityIndicator size="small" color={Colors.blue} />
                  ) : (
                    <FontAwesome name="location-arrow" size={14} color={Colors.blue} />
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.captureBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({ pathname: '/camera', params: { huntId: hunt.id, itemId: item.id } });
                }}
              >
                <FontAwesome name="camera" size={14} color={Colors.gold} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };  // close renderRow

  const Header = () => (
    <View>
      <View style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{completedCount}/{hunt.items.length}</Text>
            <Text style={styles.statLabel}>Items</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: Colors.gold }]}>{hunt.earnedPoints}</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <View style={[styles.diffPill, { backgroundColor: `${diffColor}22` }]}>
              <Text style={[styles.diffPillText, { color: diffColor }]}>{hunt.difficulty}</Text>
            </View>
          </View>
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: pct === 100 ? Colors.green : Colors.gold }]} />
        </View>

        {pct === 100 && (
          <TouchableOpacity
            style={styles.completedBanner}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({ pathname: '/hunt/complete', params: { id: hunt.id } });
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.completedBannerText}>🎉 Hunt Complete! Tap to view results →</Text>
          </TouchableOpacity>
        )}

        {/* Map button */}
        <TouchableOpacity
          style={styles.mapBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({ pathname: '/hunt/map', params: { id: hunt.id } });
          }}
        >
          <FontAwesome name="map" size={14} color={Colors.blue} />
          <Text style={styles.mapBtnText}>View Stop Map</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.itemsHeading}>Items</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={listData}
        keyExtractor={(row) => row.type === 'item' ? row.item.id : row.key}
        renderItem={renderRow}
        ListHeaderComponent={Header}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
        <FontAwesome name="trash" size={14} color={Colors.red} />
        <Text style={styles.deleteBtnText}>Delete Hunt</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 80 },

  statsCard: {
    backgroundColor: Colors.card, borderRadius: 16, padding: 20,
    marginBottom: 24, borderWidth: 1, borderColor: Colors.border,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 16 },
  stat: { alignItems: 'center', gap: 4 },
  statValue: { fontSize: 24, fontWeight: '800', color: Colors.text },
  statLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  statDivider: { width: 1, height: 36, backgroundColor: Colors.border },
  diffPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  diffPillText: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },

  progressBar: { height: 8, backgroundColor: Colors.surface, borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: '100%', borderRadius: 4 },

  completedBanner: {
    backgroundColor: Colors.greenLight, borderRadius: 10, padding: 12,
    alignItems: 'center', marginBottom: 12,
  },
  completedBannerText: { color: Colors.green, fontWeight: '700', fontSize: 14 },

  mapBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.blueLight, paddingVertical: 12, borderRadius: 10, marginTop: 4,
  },
  mapBtnText: { fontSize: 14, fontWeight: '700', color: Colors.blue },

  itemsHeading: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },

  itemCard: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderColor: Colors.border,
  },
  itemCardDone: { opacity: 0.6 },
  itemLeft: { flex: 1, flexDirection: 'row', gap: 12 },
  itemNumber: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  itemNumberText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 14 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 3 },
  itemDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 4 },
  itemSublocation: { fontSize: 12, color: Colors.blue, marginBottom: 3 },
  itemHint: { fontSize: 12, color: Colors.gold, flex: 1 },

  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 2 },
  hintPenaltyBadge: { backgroundColor: `${Colors.red}22`, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  hintPenaltyText: { fontSize: 10, fontWeight: '700', color: Colors.red },

  hintLocked: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2,
    backgroundColor: `${Colors.gold}15`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    alignSelf: 'flex-start', borderWidth: 1, borderColor: `${Colors.gold}30`,
  },
  hintLockedText: { fontSize: 12, color: Colors.gold, fontWeight: '600' },
  verificationNote: { fontSize: 12, color: Colors.green },

  itemRight: { alignItems: 'flex-end', gap: 8, marginLeft: 8 },
  itemPoints: { fontSize: 13, fontWeight: '800' },
  itemActions: { flexDirection: 'row', gap: 6 },
  swapBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  navigateBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.blueLight,
    alignItems: 'center', justifyContent: 'center',
  },
  captureBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.goldLight,
    alignItems: 'center', justifyContent: 'center',
  },

  insertRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 2, marginBottom: 2,
  },
  insertLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  insertPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: `${Colors.purple}55`,
    backgroundColor: `${Colors.purple}10`,
  },
  insertPillText: { fontSize: 12, fontWeight: '700', color: Colors.purple },
  insertIcon: { paddingHorizontal: 12 },

  deleteBtn: {
    position: 'absolute', bottom: 20, alignSelf: 'center', flexDirection: 'row',
    alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 20, backgroundColor: Colors.redLight,
  },
  deleteBtnText: { color: Colors.red, fontWeight: '600', fontSize: 14 },
});
