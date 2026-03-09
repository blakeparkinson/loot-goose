import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { useAppStore } from '@/lib/store';
import { Hunt } from '@/lib/types';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDuration(start?: string, end?: string) {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

export default function ProfileScreen() {
  const hunts = useAppStore((s) => s.hunts);

  const completedHunts = useMemo(
    () =>
      hunts
        .filter((h) => h.completedAt)
        .sort((a, b) => (b.completedAt!).localeCompare(a.completedAt!)),
    [hunts],
  );

  const stats = useMemo(() => {
    let items = 0;
    let points = 0;
    let distance = 0;
    for (const h of completedHunts) {
      items += h.items.filter((i) => i.completed).length;
      points += h.earnedPoints;
      if (h.routeMetrics?.estimatedDistanceMiles) {
        distance += h.routeMetrics.estimatedDistanceMiles;
      }
    }
    return { hunts: completedHunts.length, items, points, distance };
  }, [completedHunts]);

  const heroPhoto = (hunt: Hunt) => {
    const photo = hunt.items.find((i) => i.photoUri);
    return photo?.photoUri;
  };

  const renderStatBox = (icon: string, value: string, label: string, color: string) => (
    <View style={styles.statBox}>
      <FontAwesome name={icon as any} size={18} color={color} style={{ marginBottom: 6 }} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const renderHunt = ({ item }: { item: Hunt }) => {
    const photo = heroPhoto(item);
    const found = item.items.filter((i) => i.completed).length;
    const duration = formatDuration(item.startedAt, item.completedAt);

    return (
      <View style={styles.huntRow}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.huntPhoto} />
        ) : (
          <View style={[styles.huntPhoto, styles.huntPhotoPlaceholder]}>
            <FontAwesome name="camera" size={16} color={Colors.textMuted} />
          </View>
        )}
        <View style={styles.huntInfo}>
          <Text style={styles.huntTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.huntMeta} numberOfLines={1}>
            <FontAwesome name="map-marker" size={11} color={Colors.textMuted} /> {item.location}
          </Text>
          <View style={styles.huntStats}>
            <Text style={styles.huntStat}>
              <FontAwesome name="star" size={11} color={Colors.gold} /> {item.earnedPoints}/{item.totalPoints}
            </Text>
            <Text style={styles.huntStat}>
              <FontAwesome name="check" size={11} color={Colors.green} /> {found}/{item.items.length}
            </Text>
            {duration && (
              <Text style={styles.huntStat}>
                <FontAwesome name="clock-o" size={11} color={Colors.blue} /> {duration}
              </Text>
            )}
          </View>
        </View>
        <Text style={styles.huntDate}>{formatDate(item.completedAt!)}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={completedHunts}
        keyExtractor={(h) => h.id}
        renderItem={renderHunt}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.statsGrid}>
              {renderStatBox('trophy', String(stats.hunts), 'Hunts', Colors.gold)}
              {renderStatBox('search', String(stats.items), 'Items Found', Colors.green)}
              {renderStatBox('star', String(stats.points), 'Points', Colors.purple)}
              {renderStatBox('road', stats.distance > 0 ? `${stats.distance.toFixed(1)} mi` : '—', 'Distance', Colors.blue)}
            </View>
            {completedHunts.length > 0 && (
              <Text style={styles.sectionTitle}>Completed Hunts</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <FontAwesome name="trophy" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No completed hunts yet</Text>
            <Text style={styles.emptySubtext}>Finish a hunt to see your stats here</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: 16, paddingBottom: 32 },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    alignItems: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 2 },
  statLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  huntRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  huntPhoto: { width: 48, height: 48, borderRadius: 10 },
  huntPhotoPlaceholder: {
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  huntInfo: { flex: 1, gap: 3 },
  huntTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  huntMeta: { fontSize: 12, color: Colors.textSecondary },
  huntStats: { flexDirection: 'row', gap: 12, marginTop: 2 },
  huntStat: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  huntDate: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 17, fontWeight: '700', color: Colors.text },
  emptySubtext: { fontSize: 14, color: Colors.textSecondary },
});
