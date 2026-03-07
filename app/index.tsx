import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
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
  Animated,
  Easing,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import Colors from '@/constants/Colors';
import { useAppStore } from '@/lib/store';
import { Hunt } from '@/lib/types';
import { reverseGeocode } from '@/lib/geocoding';
import { generateHunt, loadSharedHunt, joinCoopSession } from '@/lib/api';
import { randomPlayerName } from '@/app/hunt/coop/[code]';
import { fetchWeather } from '@/lib/weather';

type FilterKey = 'all' | 'active' | 'done';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'done', label: 'Done' },
];

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: Colors.green,
  medium: Colors.gold,
  hard: Colors.red,
};

const GOOSE_IMAGE = require('@/assets/icon.png');

function FloatingGoose() {
  const float = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -14, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    floatLoop.start();

    const wobble = () => {
      Animated.sequence([
        Animated.timing(tilt, { toValue: -10, duration: 110, useNativeDriver: true }),
        Animated.timing(tilt, { toValue: 10, duration: 220, useNativeDriver: true }),
        Animated.timing(tilt, { toValue: -6, duration: 150, useNativeDriver: true }),
        Animated.timing(tilt, { toValue: 0, duration: 110, useNativeDriver: true }),
      ]).start();
    };
    const wobbleInterval = setInterval(wobble, 3500);
    wobble();

    return () => { floatLoop.stop(); clearInterval(wobbleInterval); };
  }, []);

  const rotation = tilt.interpolate({ inputRange: [-10, 10], outputRange: ['-10deg', '10deg'] });

  return (
    <Animated.View style={{ transform: [{ translateY: float }, { rotate: rotation }] }}>
      <Image source={GOOSE_IMAGE} style={styles.emptyGoose} />
    </Animated.View>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <FloatingGoose />
      <Text style={styles.emptyTitle}>No hunts yet</Text>
      <Text style={styles.emptySubtitle}>
        Tap <Text style={{ color: Colors.gold, fontWeight: '800' }}>New Hunt</Text> to build one,
        or hit <Text style={{ color: Colors.purple, fontWeight: '800' }}>Goose Loose</Text> to let us surprise you.
      </Text>
    </View>
  );
}

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
  const insets = useSafeAreaInsets();
  const hunts = useAppStore((s) => s.hunts);
  const saveHunt = useAppStore((s) => s.saveHunt);
  const deleteHunt = useAppStore((s) => s.deleteHunt);

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const [gooseLooseLoading, setGooseLooseLoading] = useState(false);
  const [gooseLooseMsg, setGooseLooseMsg] = useState('');

  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinPlayerName, setJoinPlayerName] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleMore = () => {
    const options = ['Browse Library', 'Join a Hunt', 'Cancel'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 2 },
        (i) => {
          if (i === 0) router.push('/library');
          else if (i === 1) { setJoinCode(''); setJoinModalVisible(true); }
        },
      );
    } else {
      Alert.alert('More', undefined, [
        { text: 'Browse Library', onPress: () => router.push('/library') },
        { text: 'Join a Hunt', onPress: () => { setJoinCode(''); setJoinModalVisible(true); } },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

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

  const handleJoinHunt = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 6) return;
    const name = joinPlayerName.trim() || randomPlayerName();
    setIsJoining(true);
    try {
      // Try co-op session first
      try {
        const session = await joinCoopSession(code, name);
        setJoinModalVisible(false);
        setJoinCode('');
        setJoinPlayerName('');
        router.push({
          pathname: '/hunt/coop/[code]',
          params: { code, playerName: session.playerName, huntId: '' },
        });
        return;
      } catch (coopErr: any) {
        // Only fall through if session genuinely not found
        const msg = coopErr.message ?? '';
        if (!msg.includes('not found') && !msg.includes('404') && !msg.includes('expired')) {
          throw coopErr;
        }
      }

      // Fallback: static shared hunt (creates a local solo copy)
      const huntData = await loadSharedHunt(code);
      const newHunt: Hunt = {
        ...huntData,
        id: `hunt-${Date.now()}`,
        createdAt: new Date().toISOString(),
        earnedPoints: 0,
        items: huntData.items.map((item: any, i: number) => ({
          ...item,
          id: `item-${Date.now()}-${i}`,
          completed: false,
          photoUri: undefined,
          verificationNote: undefined,
        })),
      };
      await saveHunt(newHunt);
      setJoinModalVisible(false);
      setJoinCode('');
      setJoinPlayerName('');
      router.push(`/hunt/${newHunt.id}`);
    } catch (e: any) {
      Alert.alert('Hunt Not Found', e.message ?? 'Could not find a hunt with that code. Check and try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const completionPct = (hunt: Hunt) =>
    hunt.items.length > 0
      ? Math.round((hunt.items.filter((i) => i.completed).length / hunt.items.length) * 100)
      : 0;

  const displayedHunts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = [...hunts];
    if (q) list = list.filter(
      (h) => h.title.toLowerCase().includes(q) || h.location.toLowerCase().includes(q)
    );
    if (filter === 'active') list = list.filter((h) => completionPct(h) < 100);
    if (filter === 'done') list = list.filter((h) => completionPct(h) === 100);
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return list;
  }, [hunts, filter, searchQuery]);

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
          <View style={styles.cardBadges}>
            <View style={[styles.diffBadge, { backgroundColor: `${diffColor}22` }]}>
              <Text style={[styles.diffText, { color: diffColor }]}>{item.difficulty}</Text>
            </View>
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


  const Toolbar = () => (
    <View style={styles.toolbar}>
      <View style={styles.filterPills}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterPill, filter === f.key && styles.filterPillActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setFilter(f.key);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterPillText, filter === f.key && styles.filterPillTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const EmptyFiltered = () => (
    <View style={styles.emptyFiltered}>
      <Text style={styles.emptyFilteredText}>
        {searchQuery.trim()
          ? `No hunts match "${searchQuery.trim()}"`
          : filter === 'active' ? 'No active hunts.' : 'No completed hunts.'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
      {hunts.length > 0 && (
        <View style={styles.searchBar}>
          <FontAwesome name="search" size={14} color={Colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search hunts…"
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <FontAwesome name="times-circle" size={15} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}
      <FlatList
        data={displayedHunts}
        keyExtractor={(h) => h.id}
        renderItem={renderHunt}
        contentContainerStyle={styles.list}
        ListHeaderComponent={hunts.length > 0 ? Toolbar : null}
        ListEmptyComponent={hunts.length === 0 ? EmptyState : EmptyFiltered}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      </View>
      {/* Bottom bar — not floating, list ends here */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
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
              <Image source={GOOSE_IMAGE} style={styles.gooseLooseEmoji} />
              <Text style={styles.gooseLooseText}>Goose Loose</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/create');
          }}
          activeOpacity={0.85}
        >
          <FontAwesome name="plus" size={18} color="#000" />
          <Text style={styles.fabText}>New Hunt</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.moreBtn}
          onPress={handleMore}
          activeOpacity={0.7}
        >
          <FontAwesome name="ellipsis-h" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Join Hunt modal */}
      <Modal
        visible={joinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setJoinModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Join a Hunt</Text>
            <Text style={styles.modalSubtitle}>Enter the 6-character code. We'll join a live co-op session if one exists, otherwise load it as a solo hunt.</Text>
            <TextInput
              style={styles.codeInput}
              placeholder="E.g. G7X2KP"
              placeholderTextColor={Colors.textMuted}
              value={joinCode}
              onChangeText={(t) => setJoinCode(t.toUpperCase().slice(0, 6))}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              autoFocus
            />
            <TextInput
              style={[styles.modalInput, { marginBottom: 20 }]}
              placeholder={`Your name (e.g. ${randomPlayerName()})`}
              placeholderTextColor={Colors.textMuted}
              value={joinPlayerName}
              onChangeText={setJoinPlayerName}
              maxLength={30}
              autoCapitalize="words"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setJoinModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, isJoining && { opacity: 0.7 }]}
                onPress={handleJoinHunt}
                disabled={isJoining || joinCode.trim().length < 6}
              >
                {isJoining ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.modalConfirmText}>Join Hunt</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, flexDirection: 'column' },
  list: { padding: 16, paddingBottom: 16, flexGrow: 1 },

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
  searchIcon: { flexShrink: 0 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    padding: 0,
  },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  filterPills: { flexDirection: 'row', gap: 6 },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  filterPillActive: { borderColor: Colors.gold, backgroundColor: Colors.goldLight },
  filterPillText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  filterPillTextActive: { color: Colors.gold },
  emptyFiltered: { alignItems: 'center', paddingTop: 40 },
  emptyFilteredText: { fontSize: 15, color: Colors.textMuted },

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
  cardBadges: { alignItems: 'flex-end', gap: 4 },
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
  emptyGoose: { width: 120, height: 120, borderRadius: 28, marginBottom: 20 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  bottomBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bg,
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
  gooseLooseEmoji: { width: 26, height: 26, borderRadius: 7 },
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

  moreBtn: {
    width: 52,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
  codeInput: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 16, fontSize: 28, color: Colors.text,
    textAlign: 'center', letterSpacing: 8, fontWeight: '800',
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 14, fontSize: 15, color: Colors.text,
  },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  modalConfirmBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 14,
    backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center',
  },
  modalConfirmText: { fontSize: 15, fontWeight: '800', color: '#000' },
});
