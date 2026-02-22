import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import Colors from '@/constants/Colors';
import { useAppStore } from '@/lib/store';
import { Hunt } from '@/lib/types';
import { reverseGeocode } from '@/lib/geocoding';
import { generateHunt } from '@/lib/api';
import { fetchWeather } from '@/lib/weather';

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: Colors.green,
  medium: Colors.gold,
  hard: Colors.red,
};

const GOOSE_LOOSE_THEMES = [
  'Things that look like they have a face',
  'Objects living their best life',
  'Evidence that humans are weird',
  'Things a golden retriever would love',
  'Signs with questionable life advice',
  'Things that cost less than a coffee',
  'Nature being extra',
  'Things older than your parents',
  'Spots where a villain would monologue',
  'Things a raccoon would steal',
  'Objects that are surprisingly round',
  'Things that belong in a museum',
  'Evidence of local pride',
  'Things a pigeon would be jealous of',
  'Stuff that was clearly designed by committee',
  'Things that are trying their best',
  'Objects that spark joy (or chaos)',
  'Things you\'d find in a fever dream',
];

const GOOSE_LOOSE_MESSAGES = [
  'Finding your location...',
  'Consulting the goose oracle...',
  'Waddling through ideas...',
  'Ruffling feathers...',
  'Almost honking...',
];

export default function HomeScreen() {
  const router = useRouter();
  const hunts = useAppStore((s) => s.hunts);
  const saveHunt = useAppStore((s) => s.saveHunt);
  const deleteHunt = useAppStore((s) => s.deleteHunt);

  const [gooseLooseLoading, setGooseLooseLoading] = useState(false);
  const [gooseLooseMsg, setGooseLooseMsg] = useState('');

  const handleDelete = (hunt: Hunt) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete Hunt', `Delete "${hunt.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteHunt(hunt.id) },
    ]);
  };

  const handleGooseLoose = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setGooseLooseLoading(true);
    setGooseLooseMsg(GOOSE_LOOSE_MESSAGES[0]);

    let msgIndex = 0;
    const msgInterval = setInterval(() => {
      msgIndex = (msgIndex + 1) % GOOSE_LOOSE_MESSAGES.length;
      setGooseLooseMsg(GOOSE_LOOSE_MESSAGES[msgIndex]);
    }, 2500);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location needed', 'Goose Loose uses your location to generate a nearby hunt.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      const [locationName, weather] = await Promise.all([
        reverseGeocode(coords).then((n) => n ?? 'Nearby'),
        fetchWeather(coords),
      ]);
      const theme = GOOSE_LOOSE_THEMES[Math.floor(Math.random() * GOOSE_LOOSE_THEMES.length)];

      const hunt = await generateHunt({
        location: locationName,
        prompt: theme,
        difficulty: 'medium',
        count: 6,
        weather: weather?.context,
      });

      await saveHunt({ ...hunt, coords });
      router.push(`/hunt/${hunt.id}`);
    } catch (e: any) {
      Alert.alert('Goose Loose Failed', e.message || 'Could not generate a hunt. Try again.');
    } finally {
      clearInterval(msgInterval);
      setGooseLooseLoading(false);
    }
  };

  const completionPct = (hunt: Hunt) =>
    hunt.items.length > 0
      ? Math.round((hunt.items.filter((i) => i.completed).length / hunt.items.length) * 100)
      : 0;

  const renderHunt = ({ item }: { item: Hunt }) => {
    const pct = completionPct(item);
    const done = pct === 100;
    const diffColor = DIFFICULTY_COLOR[item.difficulty];

    return (
      <TouchableOpacity
        style={[styles.card, { borderColor: done ? Colors.green : Colors.border }]}
        onPress={() => router.push(`/hunt/${item.id}`)}
        onLongPress={() => handleDelete(item)}
        activeOpacity={0.75}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            {done && <FontAwesome name="check-circle" size={16} color={Colors.green} />}
          </View>
          <View style={[styles.diffBadge, { backgroundColor: `${diffColor}22` }]}>
            <Text style={[styles.diffText, { color: diffColor }]}>{item.difficulty}</Text>
          </View>
        </View>

        <Text style={styles.cardLocation} numberOfLines={1}>
          <FontAwesome name="map-marker" size={12} color={Colors.textSecondary} /> {item.location}
        </Text>

        <View style={styles.progressRow}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: done ? Colors.green : Colors.gold }]} />
          </View>
          <Text style={styles.progressText}>{pct}%</Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.cardMeta}>
            {item.items.filter((i) => i.completed).length}/{item.items.length} items
          </Text>
          <Text style={[styles.cardMeta, { color: Colors.gold }]}>
            {item.earnedPoints}/{item.totalPoints} pts
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const EmptyState = () => (
    <View style={styles.empty}>
      <Text style={styles.emptyGoose}>🪿</Text>
      <Text style={styles.emptyTitle}>No hunts yet</Text>
      <Text style={styles.emptySubtitle}>
        Tap <Text style={{ color: Colors.gold, fontWeight: '800' }}>New Hunt</Text> to build one,
        or hit <Text style={{ color: Colors.purple, fontWeight: '800' }}>Goose Loose</Text> to let us surprise you.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={hunts}
        keyExtractor={(h) => h.id}
        renderItem={renderHunt}
        contentContainerStyle={styles.list}
        ListEmptyComponent={EmptyState}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.fabRow}>
        {/* Goose Loose */}
        <TouchableOpacity
          style={[styles.gooseLooseBtn, gooseLooseLoading && { opacity: 0.7 }]}
          onPress={handleGooseLoose}
          disabled={gooseLooseLoading}
          activeOpacity={0.8}
        >
          {gooseLooseLoading ? (
            <>
              <ActivityIndicator size="small" color={Colors.purple} />
              <Text style={styles.gooseLooseText} numberOfLines={1}>{gooseLooseMsg}</Text>
            </>
          ) : (
            <>
              <Text style={styles.gooseLooseEmoji}>🪿</Text>
              <Text style={styles.gooseLooseText}>Goose Loose</Text>
            </>
          )}
        </TouchableOpacity>

        {/* New Hunt */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/create');
          }}
          activeOpacity={0.85}
        >
          <FontAwesome name="plus" size={20} color="#000" />
          <Text style={styles.fabText}>New Hunt</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: 16, paddingBottom: 130, flexGrow: 1 },

  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  cardTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, flex: 1 },
  diffBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  diffText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardLocation: { fontSize: 13, color: Colors.textSecondary, marginBottom: 12 },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  progressBar: { flex: 1, height: 6, backgroundColor: Colors.surface, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, width: 34, textAlign: 'right' },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  cardMeta: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingTop: 80 },
  emptyGoose: { fontSize: 72, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  fabRow: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },

  gooseLooseBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.purple,
    backgroundColor: Colors.purpleLight,
    overflow: 'hidden',
  },
  gooseLooseEmoji: { fontSize: 20 },
  gooseLooseText: { fontSize: 14, fontWeight: '800', color: Colors.purple, flexShrink: 1 },

  fab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: Colors.gold,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: { fontSize: 15, fontWeight: '800', color: '#000' },
});
