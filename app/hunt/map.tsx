import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/Colors';
import { useAppStore } from '@/lib/store';
import { HuntItem, Coords } from '@/lib/types';
import { geocodeQuery, distanceMiles } from '@/lib/geocoding';
import { openNativeMapsDirections, openMapsSearch } from '@/lib/navigation';

// ~80 metres — close enough to be "at" a stop
const ARRIVAL_THRESHOLD_MILES = 0.05;

function walkingMinutes(miles: number): string {
  const mins = Math.round((miles / 3) * 60);
  if (mins < 1) return 'Less than 1 min';
  if (mins === 1) return '~1 min walk';
  return `~${mins} min walk`;
}

export default function HuntMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const hunt = useAppStore((s) => s.hunts.find((h) => h.id === id));
  const updateItemCoords = useAppStore((s) => s.updateItemCoords);

  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  // Track which stops we've already fired haptics for so we only buzz once per arrival
  const notifiedArrivals = useRef<Set<string>>(new Set());
  const locationSub = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (hunt) navigation.setOptions({ title: `${hunt.title} — Stops` });
  }, [hunt?.title]);

  // Geocode missing coords + start live location watch
  useEffect(() => {
    if (!hunt) return;

    const startWatching = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      // Seed initial position quickly
      const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserCoords({ latitude: initial.coords.latitude, longitude: initial.coords.longitude });

      // Then watch for updates as the user moves (every ~15 m)
      locationSub.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 15,
          timeInterval: 5000,
        },
        (loc) => {
          setUserCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      );
    };

    startWatching();

    // Geocode all items missing coords in parallel
    const itemsNeedingCoords = hunt.items.filter((i) => !i.coords && i.geocodeQuery);
    if (itemsNeedingCoords.length > 0) {
      setGeocoding(true);
      Promise.all(
        itemsNeedingCoords.map(async (item) => {
          const coords = await geocodeQuery(item.geocodeQuery!);
          if (coords) await updateItemCoords(hunt.id, item.id, coords);
        })
      ).finally(() => setGeocoding(false));
    }

    return () => {
      locationSub.current?.remove();
    };
  }, []);

  // Fire haptic once when user enters a stop's radius
  useEffect(() => {
    if (!userCoords || !hunt) return;
    for (const item of hunt.items) {
      if (item.completed || !item.coords) continue;
      const dist = distanceMiles(userCoords, item.coords);
      if (dist <= ARRIVAL_THRESHOLD_MILES && !notifiedArrivals.current.has(item.id)) {
        notifiedArrivals.current.add(item.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break; // only buzz for one stop at a time
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

  const handleNavigate = async (item: HuntItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNavigatingId(item.id);
    try {
      if (item.coords) {
        await openNativeMapsDirections(item.coords);
      } else {
        await openMapsSearch(`${item.sublocation ?? item.name}, ${hunt.location}`);
      }
    } finally {
      setNavigatingId(null);
    }
  };

  const handleNavigateHunt = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (hunt.coords) {
      await openNativeMapsDirections(hunt.coords);
    } else {
      await openMapsSearch(hunt.location);
    }
  };

  // Sort incomplete stops by distance when user location is available
  const incompleteItems = [...hunt.items.filter((i) => !i.completed)].sort((a, b) => {
    if (!userCoords) return 0;
    const distA = a.coords ? distanceMiles(userCoords, a.coords) : Infinity;
    const distB = b.coords ? distanceMiles(userCoords, b.coords) : Infinity;
    return distA - distB;
  });
  const completedItems = hunt.items.filter((i) => i.completed);

  const renderItem = ({ item }: { item: HuntItem }) => {
    const dist = userCoords && item.coords ? distanceMiles(userCoords, item.coords) : null;
    const isHere = dist !== null && dist <= ARRIVAL_THRESHOLD_MILES;
    const isNavigating = navigatingId === item.id;
    const originalIndex = hunt.items.indexOf(item);

    return (
      <View
        style={[
          styles.stopCard,
          item.completed && styles.stopCardDone,
          isHere && styles.stopCardHere,
        ]}
      >
        <View
          style={[
            styles.stopNumber,
            item.completed && { backgroundColor: Colors.greenLight },
            isHere && { backgroundColor: Colors.greenLight },
          ]}
        >
          {item.completed || isHere ? (
            <FontAwesome name={item.completed ? 'check' : 'map-marker'} size={13} color={Colors.green} />
          ) : (
            <Text style={styles.stopNumberText}>{originalIndex + 1}</Text>
          )}
        </View>

        <View style={styles.stopInfo}>
          <Text
            style={[
              styles.stopName,
              item.completed && { textDecorationLine: 'line-through', color: Colors.textSecondary },
              isHere && { color: Colors.green },
            ]}
          >
            {item.name}
          </Text>
          {item.sublocation ? (
            <Text style={styles.stopSublocation} numberOfLines={1}>
              <FontAwesome name="map-pin" size={11} color={Colors.blue} /> {item.sublocation}
            </Text>
          ) : null}
          {isHere ? (
            <Text style={styles.stopHereLabel}>You're here!</Text>
          ) : dist !== null ? (
            <Text style={styles.stopDist}>{walkingMinutes(dist)}</Text>
          ) : geocoding && item.geocodeQuery && !item.coords ? (
            <Text style={styles.stopDistLoading}>Locating…</Text>
          ) : null}
          <Text style={[styles.stopPoints, { color: item.completed ? Colors.green : Colors.gold }]}>
            {item.points} pts
          </Text>
        </View>

        {!item.completed && (
          isHere ? (
            <TouchableOpacity
              style={styles.cameraBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: '/camera', params: { huntId: hunt.id, itemId: item.id } });
              }}
            >
              <FontAwesome name="camera" size={14} color={Colors.green} />
              <Text style={styles.cameraBtnText}>Snap</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => handleNavigate(item)}
              disabled={isNavigating}
            >
              {isNavigating ? (
                <ActivityIndicator size="small" color={Colors.blue} />
              ) : (
                <>
                  <FontAwesome name="location-arrow" size={14} color={Colors.blue} />
                  <Text style={styles.navBtnText}>Go</Text>
                </>
              )}
            </TouchableOpacity>
          )
        )}
      </View>
    );
  };

  const Header = () => (
    <View>
      <TouchableOpacity style={styles.huntCard} onPress={handleNavigateHunt} activeOpacity={0.75}>
        <View style={styles.huntCardLeft}>
          <FontAwesome name="map" size={18} color={Colors.gold} />
          <View style={{ flex: 1 }}>
            <Text style={styles.huntCardTitle}>{hunt.title}</Text>
            <Text style={styles.huntCardLocation}>{hunt.location}</Text>
          </View>
        </View>
        <View style={styles.openMapsBtn}>
          <FontAwesome name="location-arrow" size={13} color={Colors.gold} />
          <Text style={styles.openMapsBtnText}>Directions</Text>
        </View>
      </TouchableOpacity>

      {geocoding && (
        <View style={styles.geocodingBanner}>
          <ActivityIndicator size="small" color={Colors.textSecondary} />
          <Text style={styles.geocodingText}>Finding stop locations…</Text>
        </View>
      )}

      {incompleteItems.length > 0 && (
        <Text style={styles.sectionLabel}>
          {userCoords ? 'Nearest First' : 'Remaining Stops'}
        </Text>
      )}
    </View>
  );

  const Footer = () =>
    completedItems.length > 0 ? (
      <View>
        <Text style={styles.sectionLabel}>Completed</Text>
        {completedItems.map((item) => renderItem({ item }))}
      </View>
    ) : null;

  return (
    <View style={styles.container}>
      <FlatList
        data={incompleteItems}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        ListHeaderComponent={Header}
        ListFooterComponent={Footer}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.allDone}>
            <Text style={styles.allDoneEmoji}>🎉</Text>
            <Text style={styles.allDoneText}>All stops completed!</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 40 },

  huntCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: `${Colors.gold}44`,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  huntCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  huntCardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  huntCardLocation: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  openMapsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.goldLight, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
  },
  openMapsBtnText: { fontSize: 13, fontWeight: '700', color: Colors.gold },

  geocodingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 4, marginBottom: 8,
  },
  geocodingText: { fontSize: 13, color: Colors.textSecondary },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },

  stopCard: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  stopCardDone: { opacity: 0.55 },
  stopCardHere: {
    borderColor: Colors.green,
    backgroundColor: `${Colors.green}10`,
  },

  stopNumber: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stopNumberText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 14 },
  stopInfo: { flex: 1, gap: 3 },
  stopName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  stopSublocation: { fontSize: 12, color: Colors.blue },
  stopDist: { fontSize: 12, color: Colors.textSecondary },
  stopDistLoading: { fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic' },
  stopHereLabel: { fontSize: 12, fontWeight: '700', color: Colors.green },
  stopPoints: { fontSize: 12, fontWeight: '700' },

  navBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.blueLight, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, minWidth: 52, justifyContent: 'center',
  },
  navBtnText: { fontSize: 13, fontWeight: '700', color: Colors.blue },

  cameraBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.greenLight, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, minWidth: 52, justifyContent: 'center',
  },
  cameraBtnText: { fontSize: 13, fontWeight: '700', color: Colors.green },

  allDone: { alignItems: 'center', paddingTop: 40, gap: 10 },
  allDoneEmoji: { fontSize: 48 },
  allDoneText: { fontSize: 18, fontWeight: '700', color: Colors.text },
});
