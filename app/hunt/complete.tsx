import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Share,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/Colors';
import { useAppStore } from '@/lib/store';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 48) / 2;

function formatDuration(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export default function HuntCompleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const hunt = useAppStore((s) => s.hunts.find((h) => h.id === id));

  const gooseScale = useRef(new Animated.Value(0)).current;
  const gooseBounce = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(40)).current;
  const statsSlide = useRef(new Animated.Value(30)).current;
  const photosSlide = useRef(new Animated.Value(30)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.3)).current;
  const starSpin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Goose pops in
    Animated.spring(gooseScale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();

    // Staggered content slides in
    Animated.stagger(100, [
      Animated.timing(fadeIn, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(titleSlide, { toValue: 0, duration: 400, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      Animated.timing(statsSlide, { toValue: 0, duration: 400, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      Animated.timing(photosSlide, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    // Continuous goose bounce
    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(gooseBounce, { toValue: -18, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(gooseBounce, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    bounceLoop.start();

    // Glow pulse
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 0.7, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0.25, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    glowLoop.start();

    // Star spin
    const spinLoop = Animated.loop(
      Animated.timing(starSpin, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })
    );
    spinLoop.start();

    return () => { bounceLoop.stop(); glowLoop.stop(); spinLoop.stop(); };
  }, []);

  if (!hunt) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: Colors.textSecondary }}>Hunt not found.</Text>
      </View>
    );
  }

  const completedItems = hunt.items.filter((i) => i.completed);
  const itemsWithPhotos = completedItems.filter((i) => i.photoUri);
  const duration =
    hunt.startedAt && hunt.completedAt
      ? formatDuration(new Date(hunt.completedAt).getTime() - new Date(hunt.startedAt).getTime())
      : null;

  const starRotate = starSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const lines = [
      `🪿 LOOT GOOSE — ${hunt.title}`,
      `📍 ${hunt.location}`,
      `🏆 ${hunt.earnedPoints}/${hunt.totalPoints} pts`,
      `✅ ${completedItems.length}/${hunt.items.length} items found`,
      duration ? `⏱️ Finished in ${duration}` : null,
      ``,
      `HONK if you found it!`,
    ].filter(Boolean).join('\n');
    await Share.share({ message: lines });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero celebration area */}
        <View style={styles.hero}>
          <Animated.View style={[styles.glowRing, { opacity: glowPulse }]} />
          <Animated.View style={[styles.glowRingOuter, { opacity: Animated.multiply(glowPulse, 0.4) as any }]} />

          {/* Spinning star accents */}
          <Animated.Text style={[styles.starTL, { transform: [{ rotate: starRotate }] }]}>✨</Animated.Text>
          <Animated.Text style={[styles.starTR, { transform: [{ rotate: starRotate }] }]}>🪙</Animated.Text>
          <Animated.Text style={[styles.starBL, { transform: [{ rotate: starRotate }] }]}>🪙</Animated.Text>
          <Animated.Text style={[styles.starBR, { transform: [{ rotate: starRotate }] }]}>✨</Animated.Text>

          <Animated.Text
            style={[styles.goose, { transform: [{ scale: gooseScale }, { translateY: gooseBounce }] }]}
          >
            🪿
          </Animated.Text>

          <Animated.Text style={[styles.heroTitle, { opacity: fadeIn, transform: [{ translateY: titleSlide }] }]}>
            HUNT COMPLETE!
          </Animated.Text>
          <Animated.Text style={[styles.huntTitle, { opacity: fadeIn, transform: [{ translateY: titleSlide }] }]}>
            {hunt.title}
          </Animated.Text>
          <Animated.Text style={[styles.huntLocation, { opacity: fadeIn, transform: [{ translateY: titleSlide }] }]}>
            <FontAwesome name="map-marker" size={12} color={Colors.textSecondary} /> {hunt.location}
          </Animated.Text>
        </View>

        {/* Stats */}
        <Animated.View style={[styles.statsCard, { opacity: fadeIn, transform: [{ translateY: statsSlide }] }]}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{hunt.earnedPoints}</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{completedItems.length}/{hunt.items.length}</Text>
            <Text style={styles.statLabel}>Items</Text>
          </View>
          {duration && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{duration}</Text>
                <Text style={styles.statLabel}>Time</Text>
              </View>
            </>
          )}
        </Animated.View>

        {/* Photo grid */}
        {itemsWithPhotos.length > 0 && (
          <Animated.View style={[{ opacity: fadeIn, transform: [{ translateY: photosSlide }] }]}>
            <Text style={styles.sectionLabel}>Your Captures</Text>
            <View style={styles.photoGrid}>
              {itemsWithPhotos.map((item) => (
                <View key={item.id} style={styles.photoCell}>
                  <Image source={{ uri: item.photoUri }} style={styles.photo} />
                  <View style={styles.photoOverlay}>
                    <Text style={styles.photoName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.photoPoints}>{item.points}pts</Text>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Bottom actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
          <FontAwesome name="share" size={16} color={Colors.gold} />
          <Text style={styles.shareBtnText}>Share Score</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.replace('/');
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.doneBtnText}>Back to Hunts</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 120 },

  hero: {
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  glowRing: {
    position: 'absolute',
    top: 36,
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: Colors.green,
    shadowColor: Colors.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 28,
  },
  glowRingOuter: {
    position: 'absolute',
    top: 16,
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1.5,
    borderColor: Colors.green,
  },
  starTL: { position: 'absolute', top: 52, left: '12%', fontSize: 24 },
  starTR: { position: 'absolute', top: 44, right: '10%', fontSize: 22 },
  starBL: { position: 'absolute', top: 160, left: '8%', fontSize: 20 },
  starBR: { position: 'absolute', top: 152, right: '6%', fontSize: 22 },

  goose: { fontSize: 100, marginBottom: 16 },

  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.green,
    letterSpacing: 2,
    marginBottom: 8,
  },
  huntTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  huntLocation: {
    fontSize: 14,
    color: Colors.textSecondary,
  },

  statsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: `${Colors.green}44`,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 26, fontWeight: '900', color: Colors.gold },
  statLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  statDivider: { width: 1, backgroundColor: Colors.border },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
  },
  photoCell: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  photo: { width: '100%', height: '100%' },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.62)',
    padding: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
  },
  photoName: { flex: 1, fontSize: 11, fontWeight: '700', color: '#fff', lineHeight: 14 },
  photoPoints: { fontSize: 11, fontWeight: '800', color: Colors.gold },

  actions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 36,
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.gold,
  },
  shareBtnText: { fontSize: 15, fontWeight: '700', color: Colors.gold },
  doneBtn: {
    backgroundColor: Colors.gold,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  doneBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
});
