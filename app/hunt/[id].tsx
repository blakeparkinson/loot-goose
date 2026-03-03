import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActionSheetIOS,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Share,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/Colors';
import { useAppStore, hintPenalty } from '@/lib/store';

import * as Location from 'expo-location';
import { HuntItem, Coords } from '@/lib/types';
import { geocodeQuery, distanceMiles } from '@/lib/geocoding';
import { openNativeMapsDirections, openMapsSearch, openRouteInMaps } from '@/lib/navigation';
import { swapItem, insertItem, tuneHunt, createCoopSession, publishHunt } from '@/lib/api';
import { randomPlayerName } from '@/app/hunt/coop/[code]';

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: Colors.green,
  medium: Colors.gold,
  hard: Colors.red,
};

function haversineMi(a: Coords, b: Coords): number {
  const R = 3958.8;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(x));
}

function routeDistanceMi(items: HuntItem[]): number | null {
  const coords = items.map((i) => i.coords).filter((c): c is Coords => !!c);
  if (coords.length < 2) return null;
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversineMi(coords[i - 1], coords[i]);
  return total;
}

export default function HuntScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const hunt = useAppStore((s) => s.hunts.find((h) => h.id === id));
  const deleteHunt = useAppStore((s) => s.deleteHunt);
  const saveHunt = useAppStore((s) => s.saveHunt);
  const updateItemCoords = useAppStore((s) => s.updateItemCoords);
  const replaceItem = useAppStore((s) => s.replaceItem);
  const revealHint = useAppStore((s) => s.revealHint);
  const insertItemAfter = useAppStore((s) => s.insertItemAfter);
  const deleteItem = useAppStore((s) => s.deleteItem);
  const replaceIncompleteItems = useAppStore((s) => s.replaceIncompleteItems);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [swappingId, setSwappingId] = useState<string | null>(null);
  const [revealingHintId, setRevealingHintId] = useState<string | null>(null);
  const [insertingAfterId, setInsertingAfterId] = useState<string | null>(null);
  const [expandedLore, setExpandedLore] = useState<Set<string>>(new Set());

  // Stop prompt modal
  type PendingAction =
    | { type: 'swap'; item: HuntItem }
    | { type: 'insert'; afterItem: HuntItem; beforeItem: HuntItem };
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [stopPrompt, setStopPrompt] = useState('');

  // Tune hunt modal
  const [tuneModalVisible, setTuneModalVisible] = useState(false);
  const [tuneFeedback, setTuneFeedback] = useState('');
  const [isTuning, setIsTuning] = useState(false);

  // Co-op
  const [coopModalVisible, setCoopModalVisible] = useState(false);
  const [coopPlayerName, setCoopPlayerName] = useState('');
  const [isCreatingCoop, setIsCreatingCoop] = useState(false);

  // Publish
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishModalVisible, setPublishModalVisible] = useState(false);

  // Arrival detection
  const [nearbyItemId, setNearbyItemId] = useState<string | null>(null);
  const huntRef = useRef(hunt);
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const notifiedArrivals = useRef<Set<string>>(new Set());
  const ARRIVAL_THRESHOLD_MILES = 0.05; // ~260ft

  useEffect(() => { huntRef.current = hunt; }, [hunt]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 4000 },
        (loc) => {
          const user = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          const currentHunt = huntRef.current;
          if (!currentHunt) return;
          let found: string | null = null;
          for (const item of currentHunt.items) {
            if (item.completed || !item.coords) continue;
            if (distanceMiles(user, item.coords) <= ARRIVAL_THRESHOLD_MILES) {
              found = item.id;
              if (!notifiedArrivals.current.has(item.id)) {
                notifiedArrivals.current.add(item.id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              break;
            }
          }
          setNearbyItemId(found);
        }
      );
    })();
    return () => { locationSub.current?.remove(); };
  }, []);

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
  const distMi = routeDistanceMi(hunt.items);
  const distLabel = distMi === null ? null
    : distMi < 0.1 ? `~${Math.round(distMi * 5280)} ft`
    : `~${distMi.toFixed(1)} mi`;

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

  const handleDeleteItem = (item: HuntItem) => {
    Alert.alert('Remove Stop', `Remove "${item.name}" from this hunt?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await deleteItem(hunt!.id, item.id);
        },
      },
    ]);
  };

  const handleMenuPress = (item: HuntItem) => {
    const hasLocation = !!(item.sublocation || item.geocodeQuery);
    const options = [
      ...(hasLocation ? ['Get Directions'] : []),
      'Swap Stop',
      'Remove Stop',
      'Cancel',
    ];
    const cancelIndex = options.length - 1;
    const destructiveIndex = options.indexOf('Remove Stop');

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex, destructiveButtonIndex: destructiveIndex },
        (i) => {
          if (options[i] === 'Get Directions') handleNavigate(item);
          else if (options[i] === 'Swap Stop') handleSwap(item);
          else if (options[i] === 'Remove Stop') handleDeleteItem(item);
        },
      );
    } else {
      Alert.alert('Stop Options', undefined, [
        ...(hasLocation ? [{ text: 'Get Directions', onPress: () => handleNavigate(item) }] : []),
        { text: 'Swap Stop', onPress: () => handleSwap(item) },
        { text: 'Remove Stop', style: 'destructive' as const, onPress: () => handleDeleteItem(item) },
        { text: 'Cancel', style: 'cancel' as const },
      ], { cancelable: true });
    }
  };

  const handleTuneHunt = async () => {
    const feedback = tuneFeedback.trim();
    if (!feedback) return;
    setIsTuning(true);
    setTuneModalVisible(false);
    try {
      const incomplete = hunt!.items.filter((i) => !i.completed);
      const newItems = await tuneHunt({
        location: hunt!.location,
        prompt: hunt!.prompt,
        difficulty: hunt!.difficulty,
        feedback,
        currentStops: hunt!.items.map((i) => ({ name: i.name, sublocation: i.sublocation, completed: i.completed })),
        incompleteCount: incomplete.length,
      });
      await replaceIncompleteItems(hunt!.id, newItems);
      setTuneFeedback('');
    } catch (e: any) {
      Alert.alert('Tune Failed', e.message ?? 'Something went wrong.');
    } finally {
      setIsTuning(false);
    }
  };

  const handleCreateCoop = async () => {
    const name = coopPlayerName.trim();
    if (!name) return;
    setIsCreatingCoop(true);
    try {
      const { code } = await createCoopSession(hunt!, name);
      setCoopModalVisible(false);
      router.push({
        pathname: '/hunt/coop/[code]',
        params: { code, playerName: name, huntId: hunt!.id },
      });
    } catch (e: any) {
      Alert.alert('Co-op Failed', e.message ?? 'Could not start a co-op session.');
    } finally {
      setIsCreatingCoop(false);
    }
  };

  const handlePublish = async () => {
    if (hunt!.publishedCode) {
      setPublishModalVisible(true);
      return;
    }
    setIsPublishing(true);
    try {
      const { code } = await publishHunt(hunt!);
      await saveHunt({ ...hunt!, publishedCode: code });
      setPublishModalVisible(true);
    } catch (e: any) {
      Alert.alert('Publish Failed', e.message ?? 'Could not publish to library.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleInsert = (afterItem: HuntItem, beforeItem: HuntItem) => {
    setStopPrompt('');
    setPendingAction({ type: 'insert', afterItem, beforeItem });
  };

  const handleSwap = (item: HuntItem) => {
    setStopPrompt('');
    setPendingAction({ type: 'swap', item });
  };

  const handleConfirmStopPrompt = async () => {
    if (!pendingAction) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const customPrompt = stopPrompt.trim() || undefined;
    setPendingAction(null);

    if (pendingAction.type === 'swap') {
      const { item } = pendingAction;
      setSwappingId(item.id);
      try {
        const newItem = await swapItem({
          location: hunt!.location,
          prompt: hunt!.prompt,
          difficulty: hunt!.difficulty,
          existingItemNames: hunt!.items.filter((i) => i.id !== item.id).map((i) => i.name),
          customPrompt,
        });
        await replaceItem(hunt!.id, item.id, newItem);
      } catch (e: any) {
        Alert.alert('Swap Failed', e.message ?? 'Something went wrong.');
      } finally {
        setSwappingId(null);
      }
    } else {
      const { afterItem, beforeItem } = pendingAction;
      setInsertingAfterId(afterItem.id);
      try {
        const newItem = await insertItem({
          location: hunt!.location,
          prompt: hunt!.prompt,
          difficulty: hunt!.difficulty,
          existingItemNames: hunt!.items.map((i) => i.name),
          beforeStop: afterItem.sublocation ?? afterItem.name,
          afterStop: beforeItem.sublocation ?? beforeItem.name,
          customPrompt,
        });
        await insertItemAfter(hunt!.id, afterItem.id, newItem);
      } catch (e: any) {
        Alert.alert('Failed', e.message ?? 'Could not generate a new stop.');
      } finally {
        setInsertingAfterId(null);
      }
    }
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
    const isNearby = nearbyItemId === item.id && !item.completed;
    const penalty = hintPenalty({ ...item, hintRevealed: true });
    return (
      <View style={[styles.itemCard, item.completed && styles.itemCardDone, isNearby && styles.itemCardNearby]}>
        <View style={styles.itemCardRow}>
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
                <TouchableOpacity
                  onPress={() => {
                    const query = item.coords
                      ? `${item.coords.latitude},${item.coords.longitude}`
                      : encodeURIComponent(item.geocodeQuery || item.sublocation!);
                    const url = Platform.OS === 'ios'
                      ? `maps://?q=${query}`
                      : `geo:0,0?q=${query}`;
                    Linking.openURL(url);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.itemSublocation} numberOfLines={1}>
                    <FontAwesome name="map-pin" size={11} color={Colors.blue} /> {item.sublocation}
                  </Text>
                </TouchableOpacity>
              )}
              {!item.completed && item.lore ? (
                // New hunts: free expandable lore section
                <TouchableOpacity
                  style={styles.loreToggle}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setExpandedLore((prev) => {
                      const next = new Set(prev);
                      next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                      return next;
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <FontAwesome name="book" size={11} color={Colors.purple} />
                  <Text style={styles.loreToggleText}>
                    {expandedLore.has(item.id) ? 'Hide history' : 'Did you know?'}
                  </Text>
                  <FontAwesome
                    name={expandedLore.has(item.id) ? 'chevron-up' : 'chevron-down'}
                    size={10}
                    color={Colors.purple}
                  />
                </TouchableOpacity>
              ) : !item.completed && item.hint ? (
                // Legacy hunts: locked hint with point penalty
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
              ) : null}
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
            {item.completed && item.photoUri && (
              <Image source={{ uri: item.photoUri }} style={styles.itemThumb} />
            )}
            {!item.completed && (
              <TouchableOpacity
                style={styles.menuBtn}
                onPress={() => handleMenuPress(item)}
                disabled={swappingId !== null}
              >
                {isSwapping || isNavigating
                  ? <ActivityIndicator size="small" color={Colors.textMuted} />
                  : <FontAwesome name="ellipsis-v" size={16} color={Colors.textMuted} />
                }
              </TouchableOpacity>
            )}
          </View>
        </View>
        {!item.completed && item.lore && expandedLore.has(item.id) && (
          <View style={styles.loreBox}>
            <Text style={styles.loreText}>{item.lore}</Text>
          </View>
        )}
        {!item.completed && !isNearby && (
          <TouchableOpacity
            style={styles.snapBar}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({ pathname: '/camera', params: { huntId: hunt.id, itemId: item.id } });
            }}
            activeOpacity={0.8}
          >
            <FontAwesome name="camera" size={16} color="#000" />
            <Text style={styles.snapBarText}>Snap It</Text>
          </TouchableOpacity>
        )}
        {isNearby && (
          <TouchableOpacity
            style={styles.nearbyBanner}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({ pathname: '/camera', params: { huntId: hunt.id, itemId: item.id } });
            }}
          >
            <FontAwesome name="map-marker" size={11} color={Colors.green} />
            <Text style={styles.nearbyBannerText}>You're here — snap it!</Text>
            <FontAwesome name="camera" size={11} color={Colors.green} />
          </TouchableOpacity>
        )}
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

        {distLabel && (
          <View style={styles.distanceRow}>
            <FontAwesome name="road" size={11} color={Colors.textMuted} />
            <Text style={styles.distanceText}>{distLabel} straight-line</Text>
          </View>
        )}

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

        {/* Tune + Co-op + Route buttons */}
        <View style={styles.headerBtns}>
          <TouchableOpacity
            style={styles.tuneBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setTuneFeedback('');
              setTuneModalVisible(true);
            }}
            disabled={isTuning || hunt.items.every((i) => i.completed)}
          >
            {isTuning ? (
              <ActivityIndicator size="small" color={Colors.purple} />
            ) : (
              <>
                <FontAwesome name="magic" size={14} color={Colors.purple} />
                <Text style={styles.tuneBtnText}>Tune</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.coopBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setCoopPlayerName(randomPlayerName());
              setCoopModalVisible(true);
            }}
            disabled={isCreatingCoop}
          >
            {isCreatingCoop ? (
              <ActivityIndicator size="small" color={Colors.purple} />
            ) : (
              <>
                <FontAwesome name="group" size={13} color={Colors.purple} />
                <Text style={styles.coopBtnText}>Co-op</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.routeBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              openRouteInMaps(
                hunt.coords ?? null,
                hunt.items.map((i) => ({ coords: i.coords, query: i.geocodeQuery ?? i.sublocation ?? i.name })),
              );
            }}
          >
            <FontAwesome name="map" size={13} color={Colors.blue} />
            <Text style={styles.routeBtnText}>Route</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.itemsHeading}>Items</Text>
    </View>
  );

  const Footer = () => (
    <View style={styles.footer}>
      <TouchableOpacity style={styles.publishBtn} onPress={handlePublish} disabled={isPublishing}>
        {isPublishing
          ? <ActivityIndicator size="small" color={Colors.gold} />
          : <>
              <FontAwesome name="globe" size={13} color={Colors.gold} />
              <Text style={styles.publishBtnText}>
                {hunt!.publishedCode ? 'In Library ✓' : 'Publish to Library'}
              </Text>
            </>
        }
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
        <FontAwesome name="trash" size={13} color={Colors.red} />
        <Text style={styles.deleteBtnText}>Delete Hunt</Text>
      </TouchableOpacity>
    </View>
  );

  const isInsertAction = pendingAction?.type === 'insert';
  const modalTitle = isInsertAction ? 'Add a Stop' : 'Swap Stop';
  const modalSubtitle = isInsertAction
    ? `Between "${(pendingAction as any).afterItem?.name}" and "${(pendingAction as any).beforeItem?.name}"`
    : `Replacing "${(pendingAction as any)?.item?.name}"`;

  return (
    <View style={styles.container}>
      <FlatList
        data={listData}
        keyExtractor={(row) => row.type === 'item' ? row.item.id : row.key}
        renderItem={renderRow}
        ListHeaderComponent={Header}
        ListFooterComponent={Footer}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      {/* Tune Hunt modal */}
      <Modal
        visible={tuneModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTuneModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tune This Hunt</Text>
            <Text style={styles.modalSubtitle}>Describe what you'd change and we'll regenerate the remaining stops.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={`e.g. "more food spots", "keep stops closer together", "add street art", "follow the riverfront"`}
              placeholderTextColor={Colors.textMuted}
              value={tuneFeedback}
              onChangeText={setTuneFeedback}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              autoFocus
            />
            <Text style={styles.modalHint}>Completed stops are kept. Only remaining stops are replaced.</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setTuneModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: Colors.purple }]}
                onPress={handleTuneHunt}
                disabled={!tuneFeedback.trim()}
              >
                <FontAwesome name="magic" size={13} color="#fff" />
                <Text style={[styles.modalConfirmText, { color: '#fff' }]}>Tune It</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Co-op modal */}
      <Modal
        visible={coopModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCoopModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Start Co-op Hunt</Text>
            <Text style={styles.modalSubtitle}>Your team shares items in real-time. Anyone can complete any stop.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Your display name"
              placeholderTextColor={Colors.textMuted}
              value={coopPlayerName}
              onChangeText={setCoopPlayerName}
              maxLength={30}
              autoFocus
            />
            <Text style={styles.modalHint}>Others join with the code you'll get after starting.</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setCoopModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: Colors.purple }, (!coopPlayerName.trim() || isCreatingCoop) && { opacity: 0.6 }]}
                onPress={handleCreateCoop}
                disabled={!coopPlayerName.trim() || isCreatingCoop}
              >
                {isCreatingCoop ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <FontAwesome name="group" size={13} color="#fff" />
                    <Text style={[styles.modalConfirmText, { color: '#fff' }]}>Start Co-op</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Stop prompt modal */}
      <Modal
        visible={!!pendingAction}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingAction(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <Text style={styles.modalSubtitle} numberOfLines={2}>{modalSubtitle}</Text>

            <TextInput
              style={styles.modalInput}
              placeholder={`What kind of stop? (optional)\ne.g. a great coffee shop, street art, something historic…`}
              placeholderTextColor={Colors.textMuted}
              value={stopPrompt}
              onChangeText={setStopPrompt}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
              autoFocus
            />
            <Text style={styles.modalHint}>Leave blank to use the hunt theme.</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setPendingAction(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmStopPrompt}
              >
                <FontAwesome name="magic" size={13} color="#000" />
                <Text style={styles.modalConfirmText}>Generate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Publish confirmation modal */}
      <Modal
        visible={publishModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPublishModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {hunt.publishedCode && !isPublishing ? 'Already in Library' : 'Published to Library!'}
            </Text>
            <Text style={styles.modalSubtitle}>
              Share this code so others can discover and play your hunt.
            </Text>
            <View style={styles.publishCodeBox}>
              <Text style={styles.publishCodeText}>{hunt.publishedCode ?? ''}</Text>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setPublishModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Dismiss</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => {
                  Share.share({
                    message: `Play my Loot Goose hunt in ${hunt.location}! Code: ${hunt.publishedCode}`,
                  });
                }}
              >
                <FontAwesome name="share" size={13} color="#000" />
                <Text style={styles.modalConfirmText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 24 },

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

  distanceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginBottom: 10,
  },
  distanceText: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },

  completedBanner: {
    backgroundColor: Colors.greenLight, borderRadius: 10, padding: 12,
    alignItems: 'center', marginBottom: 12,
  },
  completedBannerText: { color: Colors.green, fontWeight: '700', fontSize: 14 },

  headerBtns: { flexDirection: 'row', gap: 8, marginTop: 4 },
  tuneBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: `${Colors.purple}18`, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: `${Colors.purple}30`,
  },
  tuneBtnText: { fontSize: 14, fontWeight: '700', color: Colors.purple },
  coopBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: `${Colors.purple}18`, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: `${Colors.purple}30`,
  },
  coopBtnText: { fontSize: 13, fontWeight: '700', color: Colors.purple },
  routeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: Colors.blueLight, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: `${Colors.blue}30`,
  },
  routeBtnText: { fontSize: 13, fontWeight: '700', color: Colors.blue },

  itemThumb: {
    width: 52, height: 52, borderRadius: 8,
    backgroundColor: Colors.surface,
  },

  itemsHeading: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },

  itemCard: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  itemCardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  itemCardDone: { opacity: 0.6 },
  itemCardNearby: { borderColor: Colors.green, backgroundColor: `${Colors.green}08` },
  nearbyBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 10, paddingVertical: 8, borderRadius: 8,
    backgroundColor: `${Colors.green}15`, borderWidth: 1, borderColor: `${Colors.green}40`,
  },
  nearbyBannerText: { fontSize: 12, fontWeight: '700', color: Colors.green },
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

  loreToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4,
    alignSelf: 'flex-start',
  },
  loreToggleText: { fontSize: 12, color: Colors.purple, fontWeight: '600' },
  loreBox: {
    marginTop: 8, marginBottom: 2,
    backgroundColor: `${Colors.purple}10`,
    borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: `${Colors.purple}25`,
  },
  loreText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  verificationNote: { fontSize: 12, color: Colors.green },

  itemRight: { alignItems: 'flex-end', gap: 8, marginLeft: 8 },
  itemPoints: { fontSize: 13, fontWeight: '800' },
  menuBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  snapBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.gold, borderRadius: 10,
    paddingVertical: 11, marginTop: 10,
  },
  snapBarText: { fontSize: 15, fontWeight: '800', color: '#000' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
    borderTopWidth: 1, borderColor: Colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 16 },
  modalInput: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 14, fontSize: 15, color: Colors.text,
    minHeight: 72, textAlignVertical: 'top',
  },
  modalHint: { fontSize: 12, color: Colors.textMuted, marginTop: 6, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  modalConfirmBtn: {
    flex: 2, flexDirection: 'row', gap: 8, paddingVertical: 14, borderRadius: 14,
    backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center',
  },
  modalConfirmText: { fontSize: 15, fontWeight: '800', color: '#000' },

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

  footer: {
    marginTop: 8,
    gap: 10,
    paddingBottom: 8,
  },
  publishBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, borderColor: `${Colors.gold}55`,
    backgroundColor: `${Colors.gold}12`,
  },
  publishBtnText: { color: Colors.gold, fontWeight: '700', fontSize: 14 },

  publishCodeBox: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 16, marginBottom: 20, alignItems: 'center',
  },
  publishCodeText: {
    fontSize: 32, fontWeight: '800', color: Colors.text,
    letterSpacing: 10, textAlign: 'center',
  },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14,
    backgroundColor: Colors.redLight,
  },
  deleteBtnText: { color: Colors.red, fontWeight: '700', fontSize: 14 },
});
