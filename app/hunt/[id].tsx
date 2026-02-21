import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/Colors';
import { useAppStore } from '@/lib/store';
import { HuntItem } from '@/lib/types';

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: Colors.green,
  medium: Colors.gold,
  hard: Colors.red,
};

export default function HuntScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const getHunt = useAppStore((s) => s.getHunt);
  const deleteHunt = useAppStore((s) => s.deleteHunt);

  const hunt = getHunt(id);

  useEffect(() => {
    if (hunt) navigation.setOptions({ title: hunt.title });
  }, [hunt?.title]);

  if (!hunt) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: Colors.textSecondary }}>Hunt not found.</Text>
      </View>
    );
  }

  const completedCount = hunt.items.filter((i) => i.completed).length;
  const pct = hunt.items.length > 0 ? (completedCount / hunt.items.length) * 100 : 0;
  const diffColor = DIFFICULTY_COLOR[hunt.difficulty];

  const handleDelete = () => {
    Alert.alert('Delete Hunt', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteHunt(hunt.id);
          router.back();
        },
      },
    ]);
  };

  const renderItem = ({ item, index }: { item: HuntItem; index: number }) => (
    <View style={[styles.itemCard, item.completed && styles.itemCardDone]}>
      <View style={styles.itemLeft}>
        <View style={[styles.itemNumber, item.completed && { backgroundColor: Colors.greenLight }]}>
          {item.completed ? (
            <FontAwesome name="check" size={14} color={Colors.green} />
          ) : (
            <Text style={styles.itemNumberText}>{index + 1}</Text>
          )}
        </View>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, item.completed && { color: Colors.textSecondary, textDecorationLine: 'line-through' }]}>
            {item.name}
          </Text>
          <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
          {!item.completed && (
            <Text style={styles.itemHint} numberOfLines={1}>
              <FontAwesome name="lightbulb-o" size={11} color={Colors.gold} /> {item.hint}
            </Text>
          )}
          {item.completed && item.verificationNote ? (
            <Text style={styles.verificationNote} numberOfLines={1}>
              <FontAwesome name="check-circle" size={11} color={Colors.green} /> {item.verificationNote}
            </Text>
          ) : null}
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
              router.push({ pathname: '/camera', params: { huntId: hunt.id, itemId: item.id } });
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
      {/* Stats card */}
      <View style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{completedCount}/{hunt.items.length}</Text>
            <Text style={styles.statLabel}>Items</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: Colors.gold }]}>{hunt.earnedPoints}</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <View style={[styles.diffPill, { backgroundColor: `${diffColor}22` }]}>
              <Text style={[styles.diffPillText, { color: diffColor }]}>{hunt.difficulty}</Text>
            </View>
          </View>
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: pct === 100 ? Colors.green : Colors.gold }]} />
        </View>

        {pct === 100 && (
          <View style={styles.completedBanner}>
            <Text style={styles.completedBannerText}>🎉 Hunt Complete! You're a Loot Goose legend.</Text>
          </View>
        )}
      </View>

      <Text style={styles.itemsHeading}>Items</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={hunt.items}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        ListHeaderComponent={Header}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
        <FontAwesome name="trash" size={14} color={Colors.red} />
        <Text style={styles.deleteBtnText}>Delete Hunt</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 80 },

  statsCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 16 },
  stat: { alignItems: 'center', gap: 4 },
  statValue: { fontSize: 24, fontWeight: '800', color: Colors.text },
  statLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  statDivider: { width: 1, height: 36, backgroundColor: Colors.border },
  diffPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  diffPillText: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },

  progressBar: { height: 8, backgroundColor: Colors.surface, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },

  completedBanner: {
    marginTop: 12,
    backgroundColor: Colors.greenLight,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  completedBannerText: { color: Colors.green, fontWeight: '700', fontSize: 14 },

  itemsHeading: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },

  itemCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemCardDone: { opacity: 0.6 },
  itemLeft: { flex: 1, flexDirection: 'row', gap: 12 },
  itemNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemNumberText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 14 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 3 },
  itemDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 4 },
  itemHint: { fontSize: 12, color: Colors.gold },
  verificationNote: { fontSize: 12, color: Colors.green },

  itemRight: { alignItems: 'flex-end', gap: 8, marginLeft: 8 },
  itemPoints: { fontSize: 13, fontWeight: '800' },
  captureBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.goldLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  deleteBtn: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.redLight,
  },
  deleteBtnText: { color: Colors.red, fontWeight: '600', fontSize: 14 },
});
