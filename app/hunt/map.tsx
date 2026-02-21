import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import * as Location from 'expo-location';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/Colors';
import { useAppStore } from '@/lib/store';
import { HuntItem, Coords } from '@/lib/types';
import { geocodeQuery, distanceMiles } from '@/lib/geocoding';
import { openNativeMaps, openMapsSearch } from '@/lib/navigation';

export default function HuntMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const getHunt = useAppStore((s) => s.getHunt);
  const updateItemCoords = useAppStore((s) => s.updateItemCoords);

  const hunt = getHunt(id);
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);

  useEffect(() => {
    if (hunt) navigation.setOptions({ title: `${hunt.title} — Stops` });
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then((loc) => {
          setUserCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        });
      }
    });
  }, []);

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
      let coords = item.coords;

      if (!coords && item.geocodeQuery) {
        coords = (await geocodeQuery(item.geocodeQuery)) ?? undefined;
        if (coords) await updateItemCoords(hunt.id, item.id, coords);
      }

      if (coords) {
        await openNativeMaps(coords, `${item.name} — ${hunt.title}`);
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
      await openNativeMaps(hunt.coords, hunt.title);
    } else {
      await openMapsSearch(hunt.location);
    }
  };

  const renderItem = ({ item, index }: { item: HuntItem; index: number }) => {
    const dist =
      userCoords && item.coords ? distanceMiles(userCoords, item.coords) : null;
    const isNavigating = navigatingId === item.id;

    return (
      <View style={[styles.stopCard, item.completed && styles.stopCardDone]}>
        <View style={[styles.stopNumber, item.completed && { backgroundColor: Colors.greenLight }]}>
          {item.completed ? (
            <FontAwesome name="check" size={13} color={Colors.green} />
          ) : (
            <Text style={styles.stopNumberText}>{index + 1}</Text>
          )}
        </View>

        <View style={styles.stopInfo}>
          <Text style={[styles.stopName, item.completed && { textDecorationLine: 'line-through', color: Colors.textSecondary }]}>
            {item.name}
          </Text>
          {item.sublocation ? (
            <Text style={styles.stopSublocation} numberOfLines={1}>
              <FontAwesome name="map-pin" size={11} color={Colors.blue} /> {item.sublocation}
            </Text>
          ) : null}
          {dist !== null ? (
            <Text style={styles.stopDist}>{dist < 0.1 ? 'You\'re here!' : `${dist.toFixed(1)} mi away`}</Text>
          ) : null}
          <Text style={[styles.stopPoints, { color: item.completed ? Colors.green : Colors.gold }]}>
            {item.points} pts
          </Text>
        </View>

        {!item.completed && (
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
        )}
      </View>
    );
  };

  const incompleteItems = hunt.items.filter((i) => !i.completed);
  const completedItems = hunt.items.filter((i) => i.completed);

  const Header = () => (
    <View>
      {/* Hunt location card */}
      <TouchableOpacity style={styles.huntCard} onPress={handleNavigateHunt} activeOpacity={0.75}>
        <View style={styles.huntCardLeft}>
          <FontAwesome name="map" size={18} color={Colors.gold} />
          <View>
            <Text style={styles.huntCardTitle}>{hunt.title}</Text>
            <Text style={styles.huntCardLocation}>{hunt.location}</Text>
          </View>
        </View>
        <View style={styles.openMapsBtn}>
          <FontAwesome name="location-arrow" size={13} color={Colors.gold} />
          <Text style={styles.openMapsBtnText}>Open in Maps</Text>
        </View>
      </TouchableOpacity>

      {incompleteItems.length > 0 && (
        <Text style={styles.sectionLabel}>Remaining Stops</Text>
      )}
    </View>
  );

  const Footer = () =>
    completedItems.length > 0 ? (
      <View>
        <Text style={styles.sectionLabel}>Completed</Text>
        {completedItems.map((item, i) => renderItem({ item, index: hunt.items.indexOf(item) }))}
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
    marginBottom: 24,
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
  stopNumber: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stopNumberText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 14 },
  stopInfo: { flex: 1, gap: 3 },
  stopName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  stopSublocation: { fontSize: 12, color: Colors.blue },
  stopDist: { fontSize: 12, color: Colors.textSecondary },
  stopPoints: { fontSize: 12, fontWeight: '700' },

  navBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.blueLight, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, minWidth: 52, justifyContent: 'center',
  },
  navBtnText: { fontSize: 13, fontWeight: '700', color: Colors.blue },

  allDone: { alignItems: 'center', paddingTop: 40, gap: 10 },
  allDoneEmoji: { fontSize: 48 },
  allDoneText: { fontSize: 18, fontWeight: '700', color: Colors.text },
});
