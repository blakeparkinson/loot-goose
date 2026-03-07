import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/Colors';
import { useAppStore } from '@/lib/store';
import { Hunt, HuntDifficulty, QuickPreset } from '@/lib/types';
import {
  browseHunts,
  clonePlayableHunt,
  LibraryHunt,
  loadLibraryHighlights,
  loadLibraryHunt,
  WeeklyChallenge,
} from '@/lib/api';

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: Colors.green,
  medium: Colors.gold,
  hard: Colors.red,
};

export default function LibraryScreen() {
  const router = useRouter();
  const saveHunt = useAppStore((s) => s.saveHunt);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LibraryHunt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCode, setLoadingCode] = useState<string | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | HuntDifficulty>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [weeklyChallenge, setWeeklyChallenge] = useState<WeeklyChallenge | null>(null);
  const [featured, setFeatured] = useState<LibraryHunt[]>([]);
  // Cache of loaded full hunts keyed by code
  const [huntCache, setHuntCache] = useState<Record<string, Hunt>>({});
  const [loadingExpandCode, setLoadingExpandCode] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchResults = async (q: string) => {
    setLoading(true);
    try {
      const [data, highlights] = await Promise.all([
        browseHunts(q),
        loadLibraryHighlights().catch(() => ({ weeklyChallenge: null, featured: [] })),
      ]);
      setResults(data);
      setWeeklyChallenge(highlights.weeklyChallenge);
      setFeatured(highlights.featured);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchResults('');
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchResults(query);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const availableTags = useMemo(
    () => Array.from(new Set(results.flatMap((item) => item.tags ?? []))).slice(0, 8),
    [results],
  );

  const displayedResults = useMemo(
    () =>
      results.filter((item) => {
        if (!query.trim() && difficultyFilter === 'all' && !tagFilter && featured.some((featuredItem) => featuredItem.code === item.code)) {
          return false;
        }
        if (difficultyFilter !== 'all' && item.difficulty !== difficultyFilter) return false;
        if (tagFilter && !(item.tags ?? []).includes(tagFilter)) return false;
        return true;
      }),
    [difficultyFilter, featured, query, results, tagFilter],
  );

  const handleToggleExpand = async (item: LibraryHunt) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (expandedCode === item.code) {
      setExpandedCode(null);
      return;
    }
    setExpandedCode(item.code);
    // Load full hunt data for item names if not cached
    if (!huntCache[item.code]) {
      setLoadingExpandCode(item.code);
      try {
        const huntData = await loadLibraryHunt(item.code);
        setHuntCache((prev) => ({ ...prev, [item.code]: huntData }));
      } catch {
        // Silently fail — play button will retry
      } finally {
        setLoadingExpandCode(null);
      }
    }
  };

  const handlePlay = async (item: LibraryHunt) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoadingCode(item.code);
    try {
      if (item.type === 'preset' && item.preset) {
        openPreset(item.preset, item.highlightBadge);
        return;
      }
      const huntData: Hunt = huntCache[item.code] ?? (await loadLibraryHunt(item.code));
      const newHunt: Hunt = clonePlayableHunt(huntData, 'library');
      await saveHunt(newHunt);
      router.push(`/hunt/${newHunt.id}`);
    } catch {
      // On error just stop loading — user can try again
    } finally {
      setLoadingCode(null);
    }
  };

  const openPreset = (preset: QuickPreset, badge?: string) => {
    router.push({
      pathname: '/create',
      params: {
        presetTitle: preset.title,
        presetSubtitle: preset.subtitle ?? '',
        presetPrompt: preset.prompt,
        presetDifficulty: preset.difficulty,
        presetStopCount: String(preset.stopCount),
        presetSuggestions: (preset.suggestions ?? []).join('|'),
        presetLocation: preset.location ?? '',
        challengeBadge: badge ?? '',
      },
    });
  };

  const renderCard = ({ item }: { item: LibraryHunt }) => {
    const isExpanded = expandedCode === item.code;
    const diffColor = DIFFICULTY_COLOR[item.difficulty] ?? Colors.gold;
    const isLoadingThis = loadingCode === item.code;
    const isLoadingExpand = loadingExpandCode === item.code;
    const cached = huntCache[item.code];
    const isFeatured = item.plays >= 5;
    const isFresh = Date.now() - new Date(item.createdAt).getTime() < 1000 * 60 * 60 * 24 * 10;

    return (
      <TouchableOpacity
        style={[styles.card, isExpanded && styles.cardExpanded]}
        onPress={() => handleToggleExpand(item)}
        activeOpacity={0.75}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          </View>
          <View style={styles.cardHeaderRight}>
            {isFeatured && (
              <View style={styles.featureBadge}>
                <Text style={styles.featureBadgeText}>Featured</Text>
              </View>
            )}
            {isFresh && (
              <View style={styles.freshBadge}>
                <Text style={styles.freshBadgeText}>Fresh</Text>
              </View>
            )}
            <View style={[styles.diffBadge, { backgroundColor: `${diffColor}22` }]}>
              <Text style={[styles.diffText, { color: diffColor }]}>{item.difficulty}</Text>
            </View>
            <FontAwesome
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={Colors.textMuted}
            />
          </View>
        </View>

        <Text style={styles.cardLocation} numberOfLines={1}>
          <FontAwesome name="map-marker" size={12} color={Colors.textSecondary} /> {item.location}
        </Text>

        <View style={styles.cardMeta}>
          <Text style={styles.metaText}>{item.itemCount} stops</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={[styles.metaText, { color: Colors.gold }]}>{item.totalPoints} pts</Text>
          {typeof item.routeDistanceMiles === 'number' && (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText}>~{item.routeDistanceMiles.toFixed(1)} mi</Text>
            </>
          )}
          <Text style={styles.metaDot}>·</Text>
          <FontAwesome name="play-circle" size={11} color={Colors.textMuted} />
          <Text style={styles.metaText}> {item.plays} plays</Text>
        </View>

        {!!item.tags?.length && (
          <View style={styles.tagRow}>
            {item.tags.slice(0, 4).map((tag) => (
              <View key={tag} style={styles.tagPill}>
                <Text style={styles.tagPillText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.divider} />
            {isLoadingExpand ? (
              <ActivityIndicator size="small" color={Colors.textMuted} style={styles.expandSpinner} />
            ) : cached ? (
              <View style={styles.itemList}>
                {cached.items.map((it, idx) => (
                  <View key={it.id} style={styles.itemRow}>
                    <Text style={styles.itemIndex}>{idx + 1}</Text>
                    <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.playBtn, (isLoadingThis || loadingCode !== null) && { opacity: 0.7 }]}
              onPress={() => handlePlay(item)}
              disabled={isLoadingThis || loadingCode !== null}
              activeOpacity={0.85}
            >
              {isLoadingThis ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <FontAwesome name="play" size={13} color="#000" />
                  <Text style={styles.playBtnText}>Play This Hunt</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const EmptyState = () => {
    if (loading) return null;
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyGoose}>🗂</Text>
        <Text style={styles.emptyTitle}>
          {query.trim() ? `No hunts found for "${query.trim()}"` : 'Be the first to publish a hunt!'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {query.trim()
            ? 'Try a different search term or browse all hunts.'
            : 'Open any hunt and tap "Publish to Library" to share it.'}
        </Text>
      </View>
    );
  };

  const renderChallengeCard = () => {
    if (!weeklyChallenge) return null;
    return (
      <TouchableOpacity
        style={styles.challengeCard}
        onPress={() => {
          if (weeklyChallenge.type === 'preset' && weeklyChallenge.preset) {
            openPreset(weeklyChallenge.preset, weeklyChallenge.badge);
          } else if (weeklyChallenge.code) {
            handlePlay({
              id: weeklyChallenge.id ?? weeklyChallenge.code,
              code: weeklyChallenge.code,
              title: weeklyChallenge.title,
              location: weeklyChallenge.location ?? 'Nearby',
              difficulty: weeklyChallenge.difficulty ?? 'medium',
              totalPoints: weeklyChallenge.totalPoints ?? 0,
              itemCount: weeklyChallenge.itemCount ?? 0,
              plays: weeklyChallenge.plays ?? 0,
              createdAt: weeklyChallenge.createdAt ?? new Date().toISOString(),
              tags: weeklyChallenge.tags ?? [],
              routeDistanceMiles: weeklyChallenge.routeDistanceMiles,
              type: 'hunt',
            });
          }
        }}
        activeOpacity={0.85}
      >
        <Text style={styles.challengeBadge}>{weeklyChallenge.badge ?? 'Weekly Challenge'}</Text>
        <Text style={styles.challengeTitle}>{weeklyChallenge.title}</Text>
        <Text style={styles.challengeSubtitle}>
          {weeklyChallenge.subtitle ?? 'Try the shared weekly hunt before it rotates out.'}
        </Text>
      </TouchableOpacity>
    );
  };

  const Header = () => (
    <View>
      {renderChallengeCard()}
      {featured.length > 0 && (
        <View style={styles.featuredSection}>
          <Text style={styles.sectionTitle}>Featured</Text>
          {featured.map((item) => (
            <View key={`${item.code || item.id}-featured-library`}>{renderCard({ item })}</View>
          ))}
        </View>
      )}
      <Text style={styles.sectionTitle}>Browse All Hunts</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <FontAwesome name="search" size={14} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title or city…"
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        {loading && <ActivityIndicator size="small" color={Colors.textMuted} />}
      </View>

      <View style={styles.filterBar}>
        {(['all', 'easy', 'medium', 'hard'] as const).map((level) => (
          <TouchableOpacity
            key={level}
            style={[styles.filterChip, difficultyFilter === level && styles.filterChipActive]}
            onPress={() => setDifficultyFilter(level)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterChipText, difficultyFilter === level && styles.filterChipTextActive]}>
              {level === 'all' ? 'All levels' : level}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {availableTags.length > 0 && (
        <View style={styles.filterBar}>
          <TouchableOpacity
            style={[styles.filterChip, tagFilter === null && styles.filterChipActive]}
            onPress={() => setTagFilter(null)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterChipText, tagFilter === null && styles.filterChipTextActive]}>Any vibe</Text>
          </TouchableOpacity>
          {availableTags.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={[styles.filterChip, tagFilter === tag && styles.filterChipActive]}
              onPress={() => setTagFilter(tag)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterChipText, tagFilter === tag && styles.filterChipTextActive]}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading && displayedResults.length === 0 ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      ) : (
        <FlatList
          data={displayedResults}
          keyExtractor={(h) => h.id}
          renderItem={renderCard}
          contentContainerStyle={styles.list}
          ListHeaderComponent={Header}
          ListEmptyComponent={EmptyState}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    padding: 0,
  },

  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  challengeCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${Colors.gold}35`,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  challengeBadge: { fontSize: 11, fontWeight: '800', color: Colors.gold, textTransform: 'uppercase', marginBottom: 8 },
  challengeTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  challengeSubtitle: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  filterBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: `${Colors.gold}16`,
    borderColor: `${Colors.gold}50`,
  },
  filterChipText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  filterChipTextActive: { color: Colors.gold },

  list: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  featuredSection: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },

  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardExpanded: { borderColor: Colors.gold },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  cardTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, flex: 1 },
  diffBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  diffText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  featureBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.purpleLight,
  },
  featureBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.purple, textTransform: 'uppercase' },
  freshBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.greenLight,
  },
  freshBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.green, textTransform: 'uppercase' },
  cardLocation: { fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },

  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  metaDot: { fontSize: 12, color: Colors.textMuted },
  tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 10 },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagPillText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' },

  expandedContent: { marginTop: 12 },
  divider: { height: 1, backgroundColor: Colors.border, marginBottom: 12 },
  expandSpinner: { marginBottom: 12 },

  itemList: { marginBottom: 14, gap: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemIndex: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.surface,
    textAlign: 'center', lineHeight: 22,
    fontSize: 11, fontWeight: '700', color: Colors.textSecondary,
    flexShrink: 0,
  },
  itemName: { fontSize: 14, color: Colors.text, flex: 1 },

  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.gold,
    borderRadius: 14,
    paddingVertical: 13,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  playBtnText: { fontSize: 15, fontWeight: '800', color: '#000' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingTop: 80 },
  emptyGoose: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
