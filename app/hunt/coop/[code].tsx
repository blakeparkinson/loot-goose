import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/Colors';
import { useAppStore } from '@/lib/store';
import { Hunt, HuntItem } from '@/lib/types';
import { CoopCompletion, joinCoopSession } from '@/lib/api';
import { subscribeToSession, unsubscribeFromSession } from '@/lib/coopClient';

type MergedItem = HuntItem & { completedBy?: string };

const RANDOM_NAMES = [
  'Honking Pete', 'Sly Goose', 'Waddle King', 'Feather McGee',
  'Beak Boss', 'Wing Commander', 'Puddle Hopper', 'Goose Supreme',
];

export function randomPlayerName(): string {
  return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
}

export default function CoopScreen() {
  const { code, playerName, huntId } = useLocalSearchParams<{
    code: string;
    playerName: string;
    huntId?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();

  const localHunt = useAppStore((s) => s.hunts.find((h) => h.id === huntId));

  const [completions, setCompletions] = useState<CoopCompletion[]>([]);
  const [players, setPlayers] = useState<{ name: string; joinedAt: string }[]>([]);
  const [remoteHuntData, setRemoteHuntData] = useState<Hunt | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'live' | 'error'>('connecting');
  const [effectivePlayerName, setEffectivePlayerName] = useState(playerName ?? randomPlayerName());

  const effectiveHunt: Hunt | null = localHunt ?? remoteHuntData;

  // Pulsing live dot
  const livePulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, { toValue: 0.3, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(livePulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    if (effectiveHunt) navigation.setOptions({ title: effectiveHunt.title });
  }, [effectiveHunt?.title]);

  useEffect(() => {
    let cancelled = false;

    // Subscribe BEFORE the async join so no events are missed during the round-trip
    subscribeToSession(code, (newCompletion) => {
      setCompletions((prev) => {
        if (prev.some((c) => c.item_id === newCompletion.item_id)) return prev;
        return [...prev, newCompletion];
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });

    joinCoopSession(code, playerName ?? randomPlayerName())
      .then(({ huntData, completions: existing, players: existingPlayers, playerName: assignedName }) => {
        if (cancelled) return;
        setRemoteHuntData(huntData as Hunt);
        setCompletions(existing);
        setPlayers(existingPlayers);
        setEffectivePlayerName(assignedName);
        setLoading(false);
        setConnectionStatus('live');
      })
      .catch((e: any) => {
        if (cancelled) return;
        setConnectionStatus('error');
        setLoading(false);
        Alert.alert('Could not join', e.message ?? 'Something went wrong.');
      });

    return () => {
      cancelled = true;
      unsubscribeFromSession();
    };
  }, [code]);

  const mergedItems = useMemo((): MergedItem[] => {
    if (!effectiveHunt) return [];
    const map = new Map(completions.map((c) => [c.item_id, c]));
    return effectiveHunt.items.map((item) => {
      const c = map.get(item.id);
      return {
        ...item,
        completed: !!c,
        verificationNote: c?.verification_note ?? undefined,
        completedBy: c?.player_name,
      };
    });
  }, [effectiveHunt, completions]);

  const earnedPoints = useMemo(
    () => mergedItems.filter((i) => i.completed).reduce((s, i) => s + i.points, 0),
    [mergedItems],
  );

  const allDone = mergedItems.length > 0 && mergedItems.every((i) => i.completed);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.green} />
        <Text style={styles.loadingText}>Joining co-op session…</Text>
      </View>
    );
  }

  if (connectionStatus === 'error' || !effectiveHunt) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: Colors.red, fontWeight: '700', marginBottom: 12 }}>Could not load hunt</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: Colors.gold }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const completedCount = mergedItems.filter((i) => i.completed).length;
  const pct = mergedItems.length > 0 ? (completedCount / mergedItems.length) * 100 : 0;

  const renderItem = ({ item }: { item: MergedItem }) => (
    <View style={[styles.itemCard, item.completed && styles.itemCardDone]}>
      <View style={styles.itemLeft}>
        <View style={[styles.itemNumber, item.completed && { backgroundColor: Colors.greenLight }]}>
          {item.completed ? (
            <FontAwesome name="check" size={14} color={Colors.green} />
          ) : (
            <Text style={styles.itemNumberText}>
              {mergedItems.indexOf(item) + 1}
            </Text>
          )}
        </View>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, item.completed && { color: Colors.textSecondary, textDecorationLine: 'line-through' }]}>
            {item.name}
          </Text>
          <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
          {!item.completed && item.sublocation && (
            <Text style={styles.itemSublocation} numberOfLines={1}>
              <FontAwesome name="map-pin" size={11} color={Colors.blue} /> {item.sublocation}
            </Text>
          )}
          {item.completed && item.completedBy && (
            <Text style={styles.completedBy}>
              <FontAwesome name="user" size={10} color={Colors.green} /> {item.completedBy}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.itemRight}>
        <Text style={[styles.itemPoints, { color: item.completed ? Colors.green : Colors.gold }]}>
          {item.points}pts
        </Text>
        {!item.completed && (
          <TouchableOpacity
            style={styles.captureBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({
                pathname: '/camera',
                params: {
                  huntId: huntId ?? '',
                  itemId: item.id,
                  coopCode: code,
                  playerName: effectivePlayerName,
                  itemNameOverride: item.name,
                  itemDescOverride: item.description,
                  itemLoreOverride: item.lore ?? item.hint,
                  itemPoints: String(item.points),
                },
              });
            }}
          >
            <FontAwesome name="camera" size={14} color={Colors.gold} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const Header = () => (
    <View>
      {/* Connection banner */}
      <View style={styles.liveBanner}>
        <Animated.View style={[styles.liveDot, { opacity: livePulse }]} />
        <Text style={styles.liveText}>LIVE</Text>
        <Text style={styles.liveCode}>{code}</Text>
        <TouchableOpacity
          onPress={() => {
            const { Share } = require('react-native');
            Share.share({ message: `Join my Loot Goose co-op hunt! Code: ${code}` });
          }}
          style={styles.shareCodeBtn}
        >
          <FontAwesome name="share-alt" size={13} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: Colors.gold }]}>{earnedPoints}</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{completedCount}/{mergedItems.length}</Text>
            <Text style={styles.statLabel}>Items</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{players.length}</Text>
            <Text style={styles.statLabel}>Players</Text>
          </View>
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: pct === 100 ? Colors.green : Colors.gold }]} />
        </View>

        {/* Player chips */}
        {players.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.playerChips} contentContainerStyle={{ gap: 6 }}>
            {players.map((p, i) => (
              <View key={i} style={[styles.playerChip, p.name === effectivePlayerName && styles.playerChipSelf]}>
                <Text style={[styles.playerChipText, p.name === effectivePlayerName && styles.playerChipTextSelf]}>
                  {p.name === effectivePlayerName ? '🪿 ' : ''}{p.name}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* All done celebration */}
      {allDone && (
        <View style={styles.allDoneBanner}>
          <Text style={styles.allDoneText}>🎉 Hunt Complete! Everyone honk!</Text>
        </View>
      )}

      <Text style={styles.itemsHeading}>Items</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={mergedItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={Header}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 15, marginTop: 8 },
  list: { padding: 16, paddingBottom: 40 },

  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${Colors.green}18`,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: `${Colors.green}30`,
  },
  liveDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.green,
  },
  liveText: { fontSize: 12, fontWeight: '800', color: Colors.green, letterSpacing: 1 },
  liveCode: { flex: 1, fontSize: 18, fontWeight: '900', color: Colors.text, letterSpacing: 4 },
  shareCodeBtn: { padding: 4 },

  statsCard: {
    backgroundColor: Colors.card, borderRadius: 16, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: Colors.border,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 14 },
  stat: { alignItems: 'center', gap: 4 },
  statValue: { fontSize: 22, fontWeight: '800', color: Colors.text },
  statLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.border },

  progressBar: { height: 6, backgroundColor: Colors.surface, borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: '100%', borderRadius: 3 },

  playerChips: { marginTop: 4 },
  playerChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  playerChipSelf: { borderColor: `${Colors.gold}55`, backgroundColor: Colors.goldLight },
  playerChipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  playerChipTextSelf: { color: Colors.gold },

  allDoneBanner: {
    backgroundColor: Colors.greenLight, borderRadius: 12, padding: 14,
    alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: `${Colors.green}44`,
  },
  allDoneText: { color: Colors.green, fontWeight: '800', fontSize: 15 },

  itemsHeading: {
    fontSize: 13, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },

  itemCard: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderColor: Colors.border,
  },
  itemCardDone: { opacity: 0.65 },
  itemLeft: { flex: 1, flexDirection: 'row', gap: 12 },
  itemNumber: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  itemNumberText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 14 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 3 },
  itemDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 4 },
  itemSublocation: { fontSize: 12, color: Colors.blue, marginBottom: 3 },
  completedBy: { fontSize: 11, color: Colors.green, marginTop: 2 },

  itemRight: { alignItems: 'flex-end', gap: 8, marginLeft: 8 },
  itemPoints: { fontSize: 13, fontWeight: '800' },
  captureBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.goldLight,
    alignItems: 'center', justifyContent: 'center',
  },
});
