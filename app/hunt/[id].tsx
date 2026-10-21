import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import { AppTheme, DarkTheme } from '@/constants/Colors';
import { useTheme } from '@/lib/useTheme';
import { useAppStore } from '@/lib/store';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { ActionSheet, ActionSheetOption } from '@/components/ActionSheet';
import { Toast } from '@/components/Toast';

import * as Location from 'expo-location';
import { HuntItem, Coords } from '@/lib/types';
import { geocodeQuery, distanceMiles } from '@/lib/geocoding';
import { openNativeMapsDirections, openMapsSearch, openRouteInMaps } from '@/lib/navigation';
import { swapItem, insertItem, tuneHunt, createCoopSession, publishHunt } from '@/lib/api';
import { buildRouteExportPreview, calculateRouteMetrics } from '@/lib/huntInsights';
import { randomPlayerName } from '@/app/hunt/coop/[code]';

const DIFFICULTY_COLOR: Record<string, keyof AppTheme> = {
  easy: 'green',
  medium: 'gold',
  hard: 'red',
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
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const hunt = useAppStore((s) => s.hunts.find((h) => h.id === id));
  const deleteHunt = useAppStore((s) => s.deleteHunt);
  const saveHunt = useAppStore((s) => s.saveHunt);
  const updateItemCoords = useAppStore((s) => s.updateItemCoords);
  const replaceItem = useAppStore((s) => s.replaceItem);
  const insertItemAfter = useAppStore((s) => s.insertItemAfter);
  const deleteItem = useAppStore((s) => s.deleteItem);
  const replaceIncompleteItems = useAppStore((s) => s.replaceIncompleteItems);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [swappingId, setSwappingId] = useState<string | null>(null);
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
  const [scoutModalVisible, setScoutModalVisible] = useState(false);
  const [isScoutLoading, setIsScoutLoading] = useState(false);
  const [isScoutTightening, setIsScoutTightening] = useState(false);
  const [scoutRerollingId, setScoutRerollingId] = useState<string | null>(null);
  const [menuSheetItem, setMenuSheetItem] = useState<HuntItem | null>(null);

  // Arrival detection + live distance
  const [nearbyItemId, setNearbyItemId] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
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
          setUserCoords(user);
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

  // Create replaces itself with this screen, and a link can open it directly, so there may be nothing
  // to go back to. Give the header a way home in that case.
  useEffect(() => {
    if (navigation.canGoBack()) return;
    navigation.setOptions({
      headerLeft: ({ tintColor }: { tintColor?: string }) => (
        <TouchableOpacity
          onPress={() => router.replace('/')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ marginRight: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Home"
        >
          <FontAwesome name="home" size={20} color={tintColor ?? C.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, router, C]);

  if (!hunt) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: C.textSecondary }}>Hunt not found.</Text>
      </View>
    );
  }

  const completedCount = hunt.items.filter((i) => i.completed).length;
  const pct = hunt.items.length > 0 ? (completedCount / hunt.items.length) * 100 : 0;
  const diffKey = DIFFICULTY_COLOR[hunt.difficulty] ?? 'gold';
  const diffColor = C[diffKey];
  const diffTextColor = diffKey === 'gold' ? C.goldText : diffColor;
  const distMi = routeDistanceMi(hunt.items);
  const distLabel = distMi === null ? null
    : distMi < 0.1 ? `~${Math.round(distMi * 5280)} ft`
    : `~${distMi.toFixed(1)} mi`;
  const routeMetrics = calculateRouteMetrics(hunt);
  // Stops are only placed on the map on demand (Scout, Directions), so a new hunt always has unmapped
  // stops. That note comes first in the warnings when present; leave it to Scout, not the banner.
  const hasUnmappedStops = routeMetrics.geocodedStopCount < routeMetrics.totalStops;
  const bannerWarning = routeMetrics.warnings[hasUnmappedStops ? 1 : 0];
  const routePreview = buildRouteExportPreview(
    hunt.coords ?? null,
    hunt.items.map((item) => ({ coords: item.coords, query: item.geocodeQuery ?? item.sublocation ?? item.name })),
  );
  const mappedStops = hunt.items.filter((item) => item.coords);
  const mapRegion = mappedStops.length > 0
    ? {
        latitude: mappedStops.reduce((sum, item) => sum + item.coords!.latitude, 0) / mappedStops.length,
        longitude: mappedStops.reduce((sum, item) => sum + item.coords!.longitude, 0) / mappedStops.length,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      }
    : undefined;

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
    setMenuSheetItem(item);
  };

  // A new stop goes between this one and the next, so only offer it when the next stop is still to find.
  const menuItemIndex = menuSheetItem ? hunt.items.findIndex((i) => i.id === menuSheetItem.id) : -1;
  const nextStop = menuItemIndex >= 0 ? hunt.items[menuItemIndex + 1] : undefined;

  const menuSheetOptions: ActionSheetOption[] = menuSheetItem ? [
    ...((menuSheetItem.sublocation || menuSheetItem.geocodeQuery) ? [{
      label: 'Get Directions',
      icon: 'map-o',
      onPress: () => handleNavigate(menuSheetItem),
    }] : []),
    { label: 'Swap Stop', icon: 'exchange', onPress: () => handleSwap(menuSheetItem) },
    ...(nextStop && !nextStop.completed ? [{
      label: 'Add Stop After',
      icon: 'plus',
      onPress: () => handleInsert(menuSheetItem, nextStop),
    }] : []),
    { label: 'Remove Stop', icon: 'trash', onPress: () => handleDeleteItem(menuSheetItem), destructive: true },
  ] : [];

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
        currentStops: hunt!.items.map((i) => ({
          name: i.name,
          sublocation: i.sublocation,
          geocodeQuery: i.geocodeQuery,
          completed: i.completed,
          coords: i.coords,
          aiConfidence: i.aiConfidence,
        })),
        incompleteCount: incomplete.length,
      });
      await replaceIncompleteItems(hunt!.id, newItems);
      setTuneFeedback('');
      Toast.show('Hunt tuned!', 'success');
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
      const { code, playerName } = await createCoopSession(hunt!, name);
      setCoopModalVisible(false);
      router.push({
        pathname: '/hunt/coop/[code]',
        params: { code, playerName, huntId: hunt!.id },
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
      Toast.show('Published to library!', 'success');
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

  const handleExportRoute = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (routePreview.omittedCount > 0) {
      Alert.alert(
        'Route shortened for Maps',
        `${routePreview.omittedCount} stop${routePreview.omittedCount === 1 ? '' : 's'} will be skipped because Google Maps limits waypoint count. Scout Mode shows the full route order.`,
      );
    }
    await openRouteInMaps(
      hunt.coords ?? null,
      hunt.items.map((item) => ({ coords: item.coords, query: item.geocodeQuery ?? item.sublocation ?? item.name })),
    );
  };

  const handleOpenScoutMode = async () => {
    setScoutModalVisible(true);
    const unresolved = hunt.items.filter((item) => !item.coords && item.geocodeQuery);
    if (unresolved.length === 0) return;

    setIsScoutLoading(true);
    try {
      await Promise.all(
        unresolved.map(async (item) => {
          const coords = await geocodeQuery(item.geocodeQuery!);
          if (coords) await updateItemCoords(hunt.id, item.id, coords);
        }),
      );
    } finally {
      setIsScoutLoading(false);
    }
  };

  const moveItem = async (itemId: string, direction: -1 | 1) => {
    const index = hunt.items.findIndex((item) => item.id === itemId);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= hunt.items.length) return;
    const nextItems = [...hunt.items];
    [nextItems[index], nextItems[swapIndex]] = [nextItems[swapIndex], nextItems[index]];
    await saveHunt({
      ...hunt,
      items: nextItems,
      routeMetrics: hunt.routeMetrics,
    });
  };

  const handleScoutReroll = async (item: HuntItem) => {
    setScoutRerollingId(item.id);
    try {
      const newItem = await swapItem({
        location: hunt.location,
        prompt: hunt.prompt,
        difficulty: hunt.difficulty,
        existingItemNames: [
          ...hunt.items.filter((candidate) => candidate.id !== item.id).map((candidate) => candidate.name),
          ...(hunt.swappedItemNames ?? []),
        ],
        huntCoords: hunt.coords,
      });
      await replaceItem(hunt.id, item.id, newItem);
    } catch (e: any) {
      Alert.alert('Reroll failed', e.message ?? 'Could not reroll that stop.');
    } finally {
      setScoutRerollingId(null);
    }
  };

  const handleTightenRoute = async () => {
    setIsScoutTightening(true);
    try {
      const incomplete = hunt.items.filter((item) => !item.completed);
      const newItems = await tuneHunt({
        location: hunt.location,
        prompt: hunt.prompt,
        difficulty: hunt.difficulty,
        feedback: 'Keep the remaining stops tighter together, reduce duplicate-feeling stops, and favor the cleanest walking route possible.',
        currentStops: hunt.items.map((item) => ({
          name: item.name,
          sublocation: item.sublocation,
          geocodeQuery: item.geocodeQuery,
          completed: item.completed,
          coords: item.coords,
          aiConfidence: item.aiConfidence,
        })),
        incompleteCount: incomplete.length,
      });
      await replaceIncompleteItems(hunt.id, newItems);
    } catch (e: any) {
      Alert.alert('Tighten route failed', e.message ?? 'Could not tighten this route right now.');
    } finally {
      setIsScoutTightening(false);
    }
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
          existingItemNames: [
            ...hunt!.items.filter((i) => i.id !== item.id).map((i) => i.name),
            ...(hunt!.swappedItemNames ?? []),
          ],
          huntCoords: hunt!.coords,
          customPrompt,
        });
        await replaceItem(hunt!.id, item.id, newItem);
        Toast.show('Stop swapped!', 'success');
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
          existingItemNames: [
            ...hunt!.items.map((i) => i.name),
            ...(hunt!.swappedItemNames ?? []),
          ],
          beforeStop: afterItem.sublocation ?? afterItem.name,
          afterStop: beforeItem.sublocation ?? beforeItem.name,
          huntCoords: hunt!.coords,
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

  const renderRow = ({ item, index }: { item: HuntItem; index: number }) => {
    const isNavigating = navigatingId === item.id;
    const isSwapping = swappingId === item.id;
    const isInsertingAfter = insertingAfterId === item.id;
    const isNearby = nearbyItemId === item.id && !item.completed;
    const summaryText = item.lore ?? item.hint;

    const distMiToItem = userCoords && item.coords && !item.completed
      ? haversineMi(userCoords, item.coords)
      : null;
    const distLabel = distMiToItem === null ? null
      : distMiToItem < 0.02 ? null  // covered by "nearby" banner
      : distMiToItem < 0.1 ? `${Math.round(distMiToItem * 5280)} ft`
      : `${distMiToItem.toFixed(1)} mi`;
    return (
      <View style={[styles.itemCard, item.completed && styles.itemCardDone, isNearby && styles.itemCardNearby]}>
        <View style={styles.itemCardRow}>
          <View style={styles.itemLeft}>
            <View style={[styles.itemNumber, item.completed && { backgroundColor: C.greenLight }]}>
              {item.completed ? (
                <FontAwesome name="check" size={14} color={C.green} />
              ) : (
                <Text style={styles.itemNumberText}>{index + 1}</Text>
              )}
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>
                {item.name}
              </Text>
              <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
              {!item.completed && item.sublocation && (
                <View style={styles.sublocRow}>
                  <FontAwesome name="map-pin" size={11} color={C.textMuted} />
                  <Text style={styles.itemSublocation} numberOfLines={1}>{item.sublocation}</Text>
                  {distLabel && (
                    <>
                      <Text style={styles.sublocSep}>·</Text>
                      <FontAwesome name="location-arrow" size={10} color={C.textMuted} />
                      <Text style={styles.distLabel}>{distLabel}</Text>
                    </>
                  )}
                </View>
              )}
              {!item.completed && summaryText ? (
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
                  hitSlop={{ top: 15, bottom: 15 }}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: expandedLore.has(item.id) }}
                >
                  <FontAwesome name="book" size={11} color={C.gold} />
                  <Text style={styles.loreToggleText}>
                    {expandedLore.has(item.id) ? 'Hide summary' : 'View summary'}
                  </Text>
                  <FontAwesome
                    name={expandedLore.has(item.id) ? 'chevron-up' : 'chevron-down'}
                    size={10}
                    color={C.gold}
                  />
                </TouchableOpacity>
              ) : null}
              {item.completed && item.verificationNote ? (
                <Text style={styles.verificationNote} numberOfLines={1}>
                  <FontAwesome name="check-circle" size={11} color={C.green} /> {item.verificationNote}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.itemRight}>
            <Text style={[styles.itemPoints, { color: item.completed ? C.green : C.gold }]}>
              {item.points}pts
            </Text>
            {item.completed && item.photoUri && (
              <Image source={{ uri: item.photoUri }} style={styles.itemThumb} />
            )}
            {!item.completed && (
              <TouchableOpacity
                style={styles.menuBtn}
                onPress={() => handleMenuPress(item)}
                disabled={swappingId !== null || insertingAfterId !== null}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel={`More options for ${item.name}`}
              >
                {isSwapping || isNavigating || isInsertingAfter
                  ? <ActivityIndicator size="small" color={C.textMuted} />
                  : <FontAwesome name="ellipsis-v" size={16} color={C.textMuted} />
                }
              </TouchableOpacity>
            )}
          </View>
        </View>
        {!item.completed && summaryText && expandedLore.has(item.id) && (
          <View style={styles.loreBox}>
            <Text style={styles.loreText}>{summaryText}</Text>
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
            <FontAwesome name="map-marker" size={11} color={C.green} />
            <Text style={styles.nearbyBannerText}>You're here — snap it!</Text>
            <FontAwesome name="camera" size={11} color={C.green} />
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
            <Text style={[styles.statValue, { color: C.goldText }]}>{hunt.earnedPoints}</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <View style={[styles.diffPill, { backgroundColor: `${diffColor}22` }]}>
              <Text style={[styles.diffPillText, { color: diffTextColor }]}>{hunt.difficulty}</Text>
            </View>
          </View>
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: pct === 100 ? C.green : C.gold }]} />
        </View>

        {distLabel && (
          <View style={styles.distanceRow}>
            <FontAwesome name="road" size={11} color={C.textMuted} />
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

        {bannerWarning && (
          <View style={styles.warningBox}>
            <FontAwesome name="exclamation-circle" size={12} color={C.gold} />
            <Text style={styles.warningText} numberOfLines={2}>{bannerWarning}</Text>
          </View>
        )}

        {/* Tune + Scout + Co-op + Route buttons */}
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
              <ActivityIndicator size="small" color={C.gold} />
            ) : (
              <>
                <FontAwesome name="magic" size={14} color={C.gold} />
                <Text style={styles.tuneBtnText}>Tune</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.previewBtn}
            onPress={handleOpenScoutMode}
            disabled={isScoutLoading}
          >
            {isScoutLoading ? (
              <ActivityIndicator size="small" color={C.gold} />
            ) : (
              <>
                <FontAwesome name="compass" size={13} color={C.gold} />
                <Text style={styles.previewBtnText}>Scout</Text>
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
              <ActivityIndicator size="small" color={C.gold} />
            ) : (
              <>
                <FontAwesome name="group" size={13} color={C.gold} />
                <Text style={styles.coopBtnText}>Co-op</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.routeBtn}
            onPress={handleExportRoute}
          >
            <FontAwesome name="map" size={13} color={C.gold} />
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
          ? <ActivityIndicator size="small" color={C.gold} />
          : <>
              <FontAwesome name="globe" size={13} color={C.gold} />
              <Text style={styles.publishBtnText}>
                {hunt!.publishedCode ? 'In Library ✓' : 'Publish to Library'}
              </Text>
            </>
        }
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
        <FontAwesome name="trash" size={13} color={C.red} />
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
        data={hunt.items}
        keyExtractor={(item) => item.id}
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
              placeholderTextColor={C.textMuted}
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
                style={styles.modalConfirmBtn}
                onPress={handleTuneHunt}
                disabled={!tuneFeedback.trim()}
              >
                <FontAwesome name="magic" size={13} color="#000" />
                <Text style={styles.modalConfirmText}>Tune It</Text>
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
              placeholderTextColor={C.textMuted}
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
                style={[styles.modalConfirmBtn, (!coopPlayerName.trim() || isCreatingCoop) && { opacity: 0.6 }]}
                onPress={handleCreateCoop}
                disabled={!coopPlayerName.trim() || isCreatingCoop}
              >
                {isCreatingCoop ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <FontAwesome name="group" size={13} color="#000" />
                    <Text style={styles.modalConfirmText}>Start Co-op</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={scoutModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setScoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.scoutCard]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Scout Mode</Text>
              <Text style={styles.modalSubtitle}>
                Preview the route shape, spot risky stops, and see what Maps will actually export before you head out.
              </Text>

              <View style={styles.scoutStatsRow}>
                <View style={styles.scoutStat}>
                  <Text style={styles.scoutStatValue}>{routeMetrics.geocodedStopCount}/{routeMetrics.totalStops}</Text>
                  <Text style={styles.scoutStatLabel}>Mapped</Text>
                </View>
                <View style={styles.scoutStat}>
                  <Text style={styles.scoutStatValue}>
                    {typeof routeMetrics.estimatedDistanceMiles === 'number' ? routeMetrics.estimatedDistanceMiles.toFixed(1) : '--'}
                  </Text>
                  <Text style={styles.scoutStatLabel}>Miles</Text>
                </View>
                <View style={styles.scoutStat}>
                  <Text style={styles.scoutStatValue}>{routePreview.routeStops.length}</Text>
                  <Text style={styles.scoutStatLabel}>Map Stops</Text>
                </View>
              </View>

              {mapRegion ? (
                <MapView
                  style={styles.scoutMap}
                  initialRegion={mapRegion}
                  userInterfaceStyle={C === DarkTheme ? 'dark' : 'light'}
                >
                  {mappedStops.map((item, index) => (
                    <Marker
                      key={item.id}
                      coordinate={item.coords!}
                      title={`${index + 1}. ${item.name}`}
                      description={item.sublocation}
                    />
                  ))}
                  {mappedStops.length >= 2 && (
                    <Polyline
                      coordinates={mappedStops.map((item) => item.coords!)}
                      strokeColor={C.blue}
                      strokeWidth={3}
                    />
                  )}
                </MapView>
              ) : (
                <View style={styles.scoutMapEmpty}>
                  <Text style={styles.scoutMapEmptyText}>Still finding these stops on the map. Try again in a moment.</Text>
                </View>
              )}

              {routeMetrics.warnings.length > 0 && (
                <View style={styles.scoutSection}>
                  <Text style={styles.scoutSectionTitle}>Sanity Check</Text>
                  {routeMetrics.warnings.map((warning) => (
                    <View key={warning} style={styles.scoutWarningRow}>
                      <FontAwesome name="warning" size={11} color={C.gold} />
                      <Text style={styles.scoutWarningText}>{warning}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.scoutSection}>
                <Text style={styles.scoutSectionTitle}>Stop Confidence</Text>
                {hunt.items.filter((item) => !item.completed).slice(0, 5).map((item) => (
                  <View key={item.id} style={styles.confidenceRow}>
                    <View style={[
                      styles.confidenceBadge,
                      item.aiConfidence === 'high'
                        ? styles.confidenceHigh
                        : item.aiConfidence === 'medium'
                          ? styles.confidenceMedium
                          : styles.confidenceLow,
                    ]}>
                      <Text style={styles.confidenceBadgeText}>{item.aiConfidence ?? 'low'}</Text>
                    </View>
                    <View style={styles.confidenceTextCol}>
                      <Text style={styles.confidenceName}>{item.name}</Text>
                      <Text style={styles.confidenceNote}>{item.confidenceNote ?? 'Needs a clearer venue or map query.'}</Text>
                      <View style={styles.scoutActionsRow}>
                        <TouchableOpacity
                          style={styles.scoutMiniBtn}
                          onPress={() => moveItem(item.id, -1)}
                          disabled={hunt.items.findIndex((candidate) => candidate.id === item.id) === 0}
                        >
                          <FontAwesome name="arrow-up" size={11} color={C.textSecondary} />
                          <Text style={styles.scoutMiniBtnText}>Up</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.scoutMiniBtn}
                          onPress={() => moveItem(item.id, 1)}
                          disabled={hunt.items.findIndex((candidate) => candidate.id === item.id) === hunt.items.length - 1}
                        >
                          <FontAwesome name="arrow-down" size={11} color={C.textSecondary} />
                          <Text style={styles.scoutMiniBtnText}>Down</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.scoutMiniBtn}
                          onPress={() => handleScoutReroll(item)}
                          disabled={scoutRerollingId === item.id}
                        >
                          {scoutRerollingId === item.id ? (
                            <ActivityIndicator size="small" color={C.gold} />
                          ) : (
                            <>
                              <FontAwesome name="refresh" size={11} color={C.gold} />
                              <Text style={[styles.scoutMiniBtnText, { color: C.goldText }]}>Reroll</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setScoutModalVisible(false)}>
                  <Text style={styles.modalCancelText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalCancelBtn, styles.tightenBtn]}
                  onPress={handleTightenRoute}
                  disabled={isScoutTightening}
                >
                  {isScoutTightening ? (
                    <ActivityIndicator size="small" color={C.gold} />
                  ) : (
                    <>
                      <FontAwesome name="compress" size={13} color={C.gold} />
                      <Text style={styles.tightenBtnText}>Tighten</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleExportRoute}>
                  <FontAwesome name="map" size={13} color="#000" />
                  <Text style={styles.modalConfirmText}>Open in Maps</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
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
              placeholderTextColor={C.textMuted}
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

      <ActionSheet
        visible={!!menuSheetItem}
        title={menuSheetItem?.name}
        options={menuSheetOptions}
        onClose={() => setMenuSheetItem(null)}
      />
    </View>
  );
}

const makeStyles = (C: AppTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 24 },

  statsCard: {
    backgroundColor: C.card, borderRadius: 16, padding: 20,
    marginBottom: 24, borderWidth: 1, borderColor: C.border,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 16 },
  stat: { alignItems: 'center', gap: 4 },
  statValue: { fontSize: 24, fontWeight: '800', color: C.text },
  statLabel: { fontSize: 12, color: C.textSecondary, fontWeight: '500' },
  statDivider: { width: 1, height: 36, backgroundColor: C.border },
  diffPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  diffPillText: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },

  progressBar: { height: 8, backgroundColor: C.surface, borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: '100%', borderRadius: 4 },

  distanceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginBottom: 10,
  },
  distanceText: { fontSize: 12, color: C.textMuted, fontWeight: '500' },

  completedBanner: {
    backgroundColor: C.greenLight, borderRadius: 10, padding: 12,
    alignItems: 'center', marginBottom: 12,
  },
  completedBannerText: { color: C.green, fontWeight: '700', fontSize: 14 },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: `${C.gold}12`,
    borderWidth: 1,
    borderColor: `${C.gold}30`,
  },
  warningText: { flex: 1, color: C.textSecondary, fontSize: 12, lineHeight: 18 },

  headerBtns: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  tuneBtn: {
    flexBasis: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: C.goldLight, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: `${C.gold}30`,
  },
  tuneBtnText: { fontSize: 14, fontWeight: '700', color: C.goldText },
  previewBtn: {
    flexBasis: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: C.goldLight, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: `${C.gold}30`,
  },
  previewBtnText: { fontSize: 13, fontWeight: '700', color: C.goldText },
  coopBtn: {
    flexBasis: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: C.goldLight, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: `${C.gold}30`,
  },
  coopBtnText: { fontSize: 13, fontWeight: '700', color: C.goldText },
  routeBtn: {
    flexBasis: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: C.goldLight, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: `${C.gold}30`,
  },
  routeBtnText: { fontSize: 13, fontWeight: '700', color: C.goldText },

  itemThumb: {
    width: 52, height: 52, borderRadius: 8,
    backgroundColor: C.surface,
  },

  itemsHeading: { fontSize: 13, fontWeight: '700', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },

  itemCard: {
    backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: C.border,
  },
  itemCardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  itemCardDone: { opacity: 0.6 },
  itemCardNearby: { borderColor: C.green, backgroundColor: `${C.green}08` },
  nearbyBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 10, paddingVertical: 8, borderRadius: 8,
    backgroundColor: `${C.green}15`, borderWidth: 1, borderColor: `${C.green}40`,
  },
  nearbyBannerText: { fontSize: 12, fontWeight: '700', color: C.green },
  itemLeft: { flex: 1, flexDirection: 'row', gap: 12 },
  itemNumber: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  itemNumberText: { color: C.textSecondary, fontWeight: '700', fontSize: 14 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 3 },
  itemDesc: { fontSize: 13, color: C.textSecondary, lineHeight: 18, marginBottom: 4 },
  sublocRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3, flexWrap: 'wrap' },
  itemSublocation: { fontSize: 12, color: C.textMuted, flexShrink: 1 },
  sublocSep: { fontSize: 12, color: C.textMuted },
  distLabel: { fontSize: 12, color: C.textMuted, fontWeight: '600' },

  loreToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4,
    alignSelf: 'flex-start',
  },
  loreToggleText: { fontSize: 12, color: C.goldText, fontWeight: '600' },
  loreBox: {
    marginTop: 8, marginBottom: 2,
    backgroundColor: `${C.gold}10`,
    borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: `${C.gold}25`,
  },
  loreText: { fontSize: 13, color: C.textSecondary, lineHeight: 19 },
  verificationNote: { fontSize: 12, color: C.textSecondary },

  itemRight: { alignItems: 'flex-end', gap: 8, marginLeft: 8 },
  itemPoints: { fontSize: 13, fontWeight: '800' },
  menuBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  snapBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: C.gold, borderRadius: 10,
    paddingVertical: 11, marginTop: 10,
  },
  snapBarText: { fontSize: 15, fontWeight: '800', color: '#000' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
    borderTopWidth: 1, borderColor: C.border,
  },
  scoutCard: { maxHeight: '88%' },
  scoutStatsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  scoutStat: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  scoutStatValue: { fontSize: 18, fontWeight: '800', color: C.text },
  scoutStatLabel: { fontSize: 11, color: C.textMuted, textTransform: 'uppercase', marginTop: 4 },
  scoutMap: { height: 220, borderRadius: 16, marginBottom: 16 },
  scoutMapEmpty: {
    height: 160,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  scoutMapEmptyText: { color: C.textSecondary, textAlign: 'center', lineHeight: 20 },
  scoutSection: { marginBottom: 16 },
  scoutSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: C.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  scoutWarningRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  scoutWarningText: { flex: 1, color: C.textSecondary, lineHeight: 18, fontSize: 12 },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  confidenceBadge: {
    minWidth: 62,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    alignItems: 'center',
  },
  confidenceHigh: { backgroundColor: C.greenLight },
  confidenceMedium: { backgroundColor: C.goldLight },
  confidenceLow: { backgroundColor: C.redLight },
  confidenceBadgeText: { fontSize: 11, fontWeight: '800', color: C.text, textTransform: 'uppercase' },
  confidenceTextCol: { flex: 1 },
  confidenceName: { color: C.text, fontWeight: '700', marginBottom: 3 },
  confidenceNote: { color: C.textSecondary, fontSize: 12, lineHeight: 18 },
  scoutActionsRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  scoutMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  scoutMiniBtnText: { fontSize: 11, fontWeight: '700', color: C.textSecondary },
  tightenBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  tightenBtnText: { fontSize: 15, fontWeight: '700', color: C.goldText },
  modalTitle: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: C.textSecondary, marginBottom: 16 },
  modalInput: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 14, fontSize: 15, color: C.text,
    minHeight: 72, textAlignVertical: 'top',
  },
  modalHint: { fontSize: 12, color: C.textMuted, marginTop: 6, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '700', color: C.textSecondary },
  modalConfirmBtn: {
    flex: 2, flexDirection: 'row', gap: 8, paddingVertical: 14, borderRadius: 14,
    backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center',
  },
  modalConfirmText: { fontSize: 15, fontWeight: '800', color: '#000' },

  footer: {
    marginTop: 8,
    gap: 10,
    paddingBottom: 8,
  },
  publishBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, borderColor: `${C.gold}55`,
    backgroundColor: `${C.gold}12`,
  },
  publishBtnText: { color: C.goldText, fontWeight: '700', fontSize: 14 },

  publishCodeBox: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 16, marginBottom: 20, alignItems: 'center',
  },
  publishCodeText: {
    fontSize: 32, fontWeight: '800', color: C.text,
    letterSpacing: 10, textAlign: 'center',
  },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14,
    backgroundColor: C.redLight,
  },
  deleteBtnText: { color: C.red, fontWeight: '700', fontSize: 14 },
});
