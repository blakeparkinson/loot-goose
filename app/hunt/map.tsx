import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/Colors';
import { useAppStore } from '@/lib/store';
import { HuntItem, Coords } from '@/lib/types';
import { geocodeQuery, distanceMiles } from '@/lib/geocoding';
import { openNativeMapsDirections, openMapsSearch } from '@/lib/navigation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 80;
const CARD_GAP = 12;
const ARRIVAL_THRESHOLD_MILES = 0.05;

function walkingMinutes(miles: number): string {
  const mins = Math.round((miles / 3) * 60);
  if (mins < 1) return "You're here!";
  if (mins === 1) return '~1 min walk';
  return `~${mins} min walk`;
}

export default function HuntMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const hunt = useAppStore((s) => s.hunts.find((h) => h.id === id));
  const updateItemCoords = useAppStore((s) => s.updateItemCoords);

  const mapRef = useRef<MapView>(null);
  const listRef = useRef<FlatList>(null);

  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const notifiedArrivals = useRef<Set<string>>(new Set());
  const locationSub = useRef<Location.LocationSubscription | null>(null);

  const PANEL_HEIGHT = 200 + insets.bottom;

  useEffect(() => {
    if (hunt) navigation.setOptions({ title: hunt.title });
  }, [hunt?.title]);

  useEffect(() => {
    if (!hunt) return;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserCoords({ latitude: initial.coords.latitude, longitude: initial.coords.longitude });
      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 15, timeInterval: 5000 },
        (loc) => setUserCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude })
      );
    })();

    const needCoords = hunt.items.filter((i) => !i.coords && i.geocodeQuery);
    if (needCoords.length > 0) {
      setGeocoding(true);
      Promise.all(
        needCoords.map(async (item) => {
          const coords = await geocodeQuery(item.geocodeQuery!);
          if (coords) await updateItemCoords(hunt.id, item.id, coords);
        })
      ).finally(() => setGeocoding(false));
    }

    return () => { locationSub.current?.remove(); };
  }, []);

  // Fit all pins after geocoding settles
  useEffect(() => {
    if (geocoding || !hunt) return;
    fitAll();
  }, [geocoding]);

  // Arrival haptic
  useEffect(() => {
    if (!userCoords || !hunt) return;
    for (const item of hunt.items) {
      if (item.completed || !item.coords) continue;
      const dist = distanceMiles(userCoords, item.coords);
      if (dist <= ARRIVAL_THRESHOLD_MILES && !notifiedArrivals.current.has(item.id)) {
        notifiedArrivals.current.add(item.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      }
    }
  }, [userCoords]);

  if (!hunt) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: Colors.textSecondary }}>Hunt not found.</Text>
      </View>
    );
  }

  const fitAll = () => {
    const coords = hunt.items.filter((i) => i.coords).map((i) => i.coords!);
    if (userCoords) coords.push(userCoords);
    if (coords.length > 0) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 80, right: 40, bottom: PANEL_HEIGHT + 20, left: 40 },
          animated: true,
        });
      }, 400);
    }
  };

  const handlePinPress = (item: HuntItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedId(item.id);
    if (item.coords) {
      mapRef.current?.animateToRegion(
        { ...item.coords, latitudeDelta: 0.005, longitudeDelta: 0.005 },
        400
      );
    }
    const index = hunt.items.findIndex((i) => i.id === item.id);
    if (index >= 0) {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.1 });
    }
  };

  const handleNavigate = async (item: HuntItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNavigatingId(item.id);
    try {
      if (item.coords) await openNativeMapsDirections(item.coords);
      else await openMapsSearch(`${item.sublocation ?? item.name}, ${hunt.location}`);
    } finally {
      setNavigatingId(null);
    }
  };

  const routeCoords = hunt.items.filter((i) => i.coords).map((i) => i.coords!);
  const remainingCount = hunt.items.filter((i) => !i.completed).length;

  const initialRegion = hunt.coords
    ? { latitude: hunt.coords.latitude, longitude: hunt.coords.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : undefined;

  const renderCard = ({ item, index }: { item: HuntItem; index: number }) => {
    const dist = userCoords && item.coords ? distanceMiles(userCoords, item.coords) : null;
    const isHere = dist !== null && dist <= ARRIVAL_THRESHOLD_MILES;
    const isSelected = selectedId === item.id;
    const isNavigating = navigatingId === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          { width: CARD_WIDTH },
          item.completed && styles.cardDone,
          isHere && styles.cardHere,
          isSelected && styles.cardSelected,
        ]}
        onPress={() => handlePinPress(item)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.cardBadge, item.completed && styles.cardBadgeDone, isHere && styles.cardBadgeHere]}>
            {item.completed ? (
              <FontAwesome name="check" size={10} color="#fff" />
            ) : isHere ? (
              <FontAwesome name="map-marker" size={10} color="#fff" />
            ) : (
              <Text style={styles.cardBadgeText}>{index + 1}</Text>
            )}
          </View>
          <Text style={[styles.cardName, item.completed && styles.cardNameDone]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.cardPts, { color: item.completed ? Colors.green : Colors.gold }]}>
            {item.points}pts
          </Text>
        </View>

        {item.sublocation ? (
          <Text style={styles.cardSub} numberOfLines={1}>📍 {item.sublocation}</Text>
        ) : null}

        <View style={styles.cardFooter}>
          <Text style={[styles.cardDist, isHere && styles.cardDistHere]} numberOfLines={1}>
            {isHere
              ? "You're here! 🎯"
              : dist !== null
              ? walkingMinutes(dist)
              : geocoding && !item.coords
              ? 'Locating…'
              : ''}
          </Text>
          {!item.completed && (
            <View style={styles.cardActions}>
              {isHere && (
                <TouchableOpacity
                  style={styles.snapBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: '/camera', params: { huntId: hunt.id, itemId: item.id } });
                  }}
                >
                  <FontAwesome name="camera" size={12} color={Colors.green} />
                  <Text style={styles.snapBtnText}>Snap</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.goBtn}
                onPress={() => handleNavigate(item)}
                disabled={isNavigating}
              >
                {isNavigating ? (
                  <ActivityIndicator size="small" color={Colors.blue} />
                ) : (
                  <>
                    <FontAwesome name="location-arrow" size={12} color={Colors.blue} />
                    <Text style={styles.goBtnText}>Go</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Full-screen map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
      >
        {/* Dashed route line in stop order */}
        {routeCoords.length > 1 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={`${Colors.gold}bb`}
            strokeWidth={3}
            lineDashPattern={[10, 6]}
          />
        )}

        {/* Stop pins */}
        {hunt.items.map((item, index) => {
          if (!item.coords) return null;
          const dist = userCoords ? distanceMiles(userCoords, item.coords) : null;
          const isHere = dist !== null && dist <= ARRIVAL_THRESHOLD_MILES;
          const isSelected = selectedId === item.id;

          return (
            <Marker
              key={item.id}
              coordinate={item.coords}
              onPress={() => handlePinPress(item)}
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 1.0 }}
            >
              <View style={styles.pinWrap}>
                <View style={[
                  styles.pin,
                  item.completed && styles.pinDone,
                  isHere && styles.pinHere,
                  isSelected && styles.pinSelected,
                ]}>
                  {item.completed ? (
                    <FontAwesome name="check" size={10} color="#fff" />
                  ) : (
                    <Text style={[styles.pinText, (item.completed || isHere) && { color: '#fff' }]}>
                      {index + 1}
                    </Text>
                  )}
                </View>
                <View style={[
                  styles.pinTail,
                  item.completed && { borderTopColor: Colors.green },
                  isHere && { borderTopColor: Colors.green },
                  isSelected && { borderTopColor: Colors.gold },
                ]} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Top-right overlay: geocoding pill + fit button */}
      <View style={[styles.overlay, { top: (Platform.OS === 'ios' ? insets.top : 8) + 8 }]}>
        {geocoding && (
          <View style={styles.geocodingPill}>
            <ActivityIndicator size="small" color={Colors.textSecondary} />
            <Text style={styles.geocodingText}>Finding stops…</Text>
          </View>
        )}
        <TouchableOpacity style={styles.fitBtn} onPress={fitAll} activeOpacity={0.8}>
          <FontAwesome name="compress" size={15} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Bottom card carousel */}
      <View style={[styles.panel, { height: PANEL_HEIGHT }]}>
        <View style={styles.panelHandle} />
        <Text style={styles.panelLabel}>
          {remainingCount > 0 ? `${remainingCount} stop${remainingCount === 1 ? '' : 's'} remaining` : '🎉 All stops complete!'}
        </Text>
        <FlatList
          ref={listRef}
          data={hunt.items}
          keyExtractor={(i) => i.id}
          renderItem={renderCard}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH + CARD_GAP}
          snapToAlignment="start"
          decelerationRate="fast"
          contentContainerStyle={styles.cardList}
          onScrollToIndexFailed={() => {}}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  overlay: {
    position: 'absolute',
    right: 12,
    alignItems: 'flex-end',
    gap: 8,
  },
  geocodingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.card, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4,
    elevation: 3,
  },
  geocodingText: { fontSize: 12, color: Colors.textSecondary },
  fitBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4,
    elevation: 3,
  },

  // Pin marker
  pinWrap: { alignItems: 'center' },
  pin: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.card, borderWidth: 2.5, borderColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 3,
    elevation: 5,
  },
  pinDone: { backgroundColor: Colors.green, borderColor: Colors.green },
  pinHere: { backgroundColor: Colors.green, borderColor: '#fff', borderWidth: 3 },
  pinSelected: { borderColor: Colors.gold, borderWidth: 3.5, transform: [{ scale: 1.15 }] },
  pinText: { fontSize: 10, fontWeight: '900', color: Colors.gold },
  pinTail: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: Colors.gold,
  },

  // Bottom panel
  panel: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.card,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: 1, borderColor: Colors.border,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 14,
  },
  panelHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 8,
  },
  panelLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    paddingHorizontal: 16, marginBottom: 10,
  },
  cardList: { paddingHorizontal: 16, gap: CARD_GAP, paddingBottom: 4 },

  // Cards
  card: {
    backgroundColor: Colors.surface, borderRadius: 14,
    padding: 12, borderWidth: 1.5, borderColor: Colors.border,
  },
  cardDone: { opacity: 0.5 },
  cardHere: { borderColor: Colors.green, backgroundColor: `${Colors.green}10` },
  cardSelected: { borderColor: Colors.gold, borderWidth: 2 },

  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  cardBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardBadgeDone: { backgroundColor: Colors.green },
  cardBadgeHere: { backgroundColor: Colors.green },
  cardBadgeText: { fontSize: 10, fontWeight: '900', color: '#000' },
  cardName: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.text },
  cardNameDone: { textDecorationLine: 'line-through', color: Colors.textSecondary },
  cardPts: { fontSize: 12, fontWeight: '700', flexShrink: 0 },

  cardSub: { fontSize: 11, color: Colors.blue, marginBottom: 6, paddingLeft: 30 },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardDist: { fontSize: 12, color: Colors.textSecondary, flex: 1 },
  cardDistHere: { color: Colors.green, fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: 6 },

  snapBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.greenLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  snapBtnText: { fontSize: 12, fontWeight: '700', color: Colors.green },

  goBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.blueLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    minWidth: 44, justifyContent: 'center',
  },
  goBtnText: { fontSize: 12, fontWeight: '700', color: Colors.blue },
});
