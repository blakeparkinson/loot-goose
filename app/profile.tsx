import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/lib/useTheme';
import { Hunt } from '@/lib/types';
import { ThemeMode } from '@/constants/Colors';

const GOOSE_IMAGE = require('@/assets/icon.png');

const RANKS: { name: string; minPoints: number; color: string }[] = [
  { name: 'Legendary Goose', minPoints: 5000, color: '#F5A623' },
  { name: 'Golden Goose', minPoints: 2000, color: '#F5A623' },
  { name: 'Veteran Honker', minPoints: 1000, color: '#BC8CFF' },
  { name: 'Trail Blazer', minPoints: 500, color: '#58A6FF' },
  { name: 'Keen Seeker', minPoints: 200, color: '#3FB950' },
  { name: 'Fresh Flock', minPoints: 0, color: '#8B949E' },
];

function getRank(points: number) {
  return RANKS.find((r) => points >= r.minPoints) ?? RANKS[RANKS.length - 1];
}

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

const THEME_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: 'system', label: 'System' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
];

const STAT_COLORS = ['#F5A623', '#3FB950', '#BC8CFF', '#58A6FF'];

export default function ProfileScreen() {
  const hunts = useAppStore((s) => s.hunts);
  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const C = useTheme();

  const gooseScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(gooseScale, {
      toValue: 1,
      friction: 4,
      tension: 160,
      useNativeDriver: true,
    }).start();
  }, []);

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

  const rank = getRank(stats.points);

  const heroPhoto = (hunt: Hunt) => {
    const photo = hunt.items.find((i) => i.photoUri);
    return photo?.photoUri;
  };

  const renderStatBox = (icon: string, value: string, label: string, color: string, index: number) => (
    <View
      key={label}
      style={[styles.statBox, { backgroundColor: C.card, borderColor: `${color}44` }]}
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}`}
    >
      <FontAwesome name={icon as any} size={18} color={color} style={{ marginBottom: 6 }} />
      <Text style={[styles.statValue, { color: C.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: C.textSecondary }]}>{label}</Text>
    </View>
  );

  const renderHunt = ({ item }: { item: Hunt }) => {
    const photo = heroPhoto(item);
    const found = item.items.filter((i) => i.completed).length;
    const duration = formatDuration(item.startedAt, item.completedAt);

    return (
      <View style={[styles.huntRow, { backgroundColor: C.card, borderColor: C.border }]} accessibilityRole="text">
        {photo ? (
          <Image source={{ uri: photo }} style={styles.huntPhoto} accessibilityLabel={`Photo from ${item.title}`} />
        ) : (
          <View style={[styles.huntPhoto, styles.huntPhotoPlaceholder, { backgroundColor: C.surface }]}>
            <FontAwesome name="camera" size={16} color={C.textMuted} />
          </View>
        )}
        <View style={styles.huntInfo}>
          <Text style={[styles.huntTitle, { color: C.text }]} numberOfLines={1}>{item.title}</Text>
          <Text style={[styles.huntMeta, { color: C.textSecondary }]} numberOfLines={1}>
            <FontAwesome name="map-marker" size={11} color={C.textMuted} /> {item.location}
          </Text>
          <View style={styles.huntStats}>
            <Text style={[styles.huntStat, { color: C.textSecondary }]}>
              <FontAwesome name="star" size={11} color={C.gold} /> {item.earnedPoints}/{item.totalPoints}
            </Text>
            <Text style={[styles.huntStat, { color: C.textSecondary }]}>
              <FontAwesome name="check" size={11} color={C.green} /> {found}/{item.items.length}
            </Text>
            {duration && (
              <Text style={[styles.huntStat, { color: C.textSecondary }]}>
                <FontAwesome name="clock-o" size={11} color={C.blue} /> {duration}
              </Text>
            )}
          </View>
        </View>
        <Text style={[styles.huntDate, { color: C.textMuted }]}>{formatDate(item.completedAt!)}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.bg }]} edges={['bottom']}>
      <FlatList
        data={completedHunts}
        keyExtractor={(h) => h.id}
        renderItem={renderHunt}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            {/* Hero header */}
            <View style={styles.heroSection}>
              <Animated.View style={{ transform: [{ scale: gooseScale }] }}>
                <Image source={GOOSE_IMAGE} style={styles.goose} accessibilityLabel="Loot Goose mascot" />
              </Animated.View>
              <Text style={[styles.rankName, { color: rank.color }]}>{rank.name}</Text>
              <Text style={[styles.rankPoints, { color: C.textSecondary }]}>{stats.points} total points</Text>
            </View>

            {/* Stats grid */}
            <View style={styles.statsGrid}>
              {renderStatBox('trophy', String(stats.hunts), 'Hunts', STAT_COLORS[0], 0)}
              {renderStatBox('search', String(stats.items), 'Items Found', STAT_COLORS[1], 1)}
              {renderStatBox('star', String(stats.points), 'Points', STAT_COLORS[2], 2)}
              {renderStatBox('road', stats.distance > 0 ? `${stats.distance.toFixed(1)} mi` : '\u2014', 'Distance', STAT_COLORS[3], 3)}
            </View>

            {completedHunts.length > 0 && (
              <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>Completed Hunts</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Image source={GOOSE_IMAGE} style={styles.emptyGoose} accessibilityLabel="Loot Goose mascot" />
            <Text style={[styles.emptyText, { color: C.text }]}>No completed hunts yet</Text>
            <Text style={[styles.emptySubtext, { color: C.textSecondary }]}>
              Get out there and find some loot, you beautiful goose.
            </Text>
          </View>
        }
        ListFooterComponent={
          <View style={[styles.themeSection, { borderTopColor: C.border }]}>
            <Text style={[styles.themeLabel, { color: C.textSecondary }]}>Appearance</Text>
            <View style={[styles.themePills, { backgroundColor: C.surface }]}>
              {THEME_OPTIONS.map((opt) => {
                const active = themeMode === opt.mode;
                return (
                  <TouchableOpacity
                    key={opt.mode}
                    style={[
                      styles.themePill,
                      active && { backgroundColor: C.gold },
                    ]}
                    onPress={() => setThemeMode(opt.mode)}
                    accessibilityRole="button"
                    accessibilityLabel={`${opt.label} theme`}
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.themePillText, active && styles.themePillTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 32 },

  heroSection: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 8,
  },
  goose: { width: 100, height: 100, borderRadius: 24, marginBottom: 14 },
  rankName: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  rankPoints: {
    fontSize: 14,
    fontWeight: '600',
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    alignItems: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  statLabel: { fontSize: 12, fontWeight: '600' },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  huntRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  huntPhoto: { width: 48, height: 48, borderRadius: 10 },
  huntPhotoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  huntInfo: { flex: 1, gap: 3 },
  huntTitle: { fontSize: 15, fontWeight: '700' },
  huntMeta: { fontSize: 12 },
  huntStats: { flexDirection: 'row', gap: 12, marginTop: 2 },
  huntStat: { fontSize: 11, fontWeight: '600' },
  huntDate: { fontSize: 11, fontWeight: '600' },

  empty: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyGoose: { width: 80, height: 80, borderRadius: 20, marginBottom: 8 },
  emptyText: { fontSize: 17, fontWeight: '700' },
  emptySubtext: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 32 },

  themeSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  themeLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  themePills: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  themePill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  themePillText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8B949E',
  },
  themePillTextActive: {
    color: '#000',
  },
});
