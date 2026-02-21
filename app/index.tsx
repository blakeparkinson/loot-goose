import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/Colors';
import { useAppStore } from '@/lib/store';
import { Hunt } from '@/lib/types';

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: Colors.green,
  medium: Colors.gold,
  hard: Colors.red,
};

export default function HomeScreen() {
  const router = useRouter();
  const hunts = useAppStore((s) => s.hunts);
  const loadHunts = useAppStore((s) => s.loadHunts);
  const deleteHunt = useAppStore((s) => s.deleteHunt);

  useEffect(() => {
    loadHunts();
  }, []);

  const handleDelete = (hunt: Hunt) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete Hunt', `Delete "${hunt.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteHunt(hunt.id) },
    ]);
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
        Tap the button below to generate your first AI scavenger hunt
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

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/create');
        }}
        activeOpacity={0.85}
      >
        <FontAwesome name="plus" size={22} color="#000" />
        <Text style={styles.fabText}>New Hunt</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: 16, paddingBottom: 120, flexGrow: 1 },

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

  fab: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
    backgroundColor: Colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: { fontSize: 17, fontWeight: '800', color: '#000' },
});
