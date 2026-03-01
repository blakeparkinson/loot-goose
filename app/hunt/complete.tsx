import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/Colors';
import { useAppStore } from '@/lib/store';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 48) / 2;

// Fixed card dimensions for the shareable capture
const CARD_WIDTH = 375;
const CARD_PHOTO_SIZE = (CARD_WIDTH - 48) / 2;

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

  // Ref for the off-screen static card (what actually gets captured)
  const cardRef = useRef<View>(null);
  const [isSaving, setIsSaving] = useState(false);

  const gooseScale = useRef(new Animated.Value(0)).current;
  const gooseBounce = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(40)).current;
  const statsSlide = useRef(new Animated.Value(30)).current;
  const photosSlide = useRef(new Animated.Value(30)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.3)).current;
  const glowPulseOuter = useRef(new Animated.Value(0.3 * 0.4)).current;
  const starSpin = useRef(new Animated.Value(0)).current;
  // Compute interpolation once in a ref — recreating it each render causes native driver issues
  const starRotate = useRef(
    starSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  ).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Animated.spring(gooseScale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: false }).start();

    Animated.stagger(100, [
      Animated.timing(fadeIn, { toValue: 1, duration: 300, useNativeDriver: false }),
      Animated.timing(titleSlide, { toValue: 0, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(statsSlide, { toValue: 0, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(photosSlide, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();

    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(gooseBounce, { toValue: -18, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(gooseBounce, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    );
    bounceLoop.start();

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowPulse, { toValue: 0.7, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(glowPulseOuter, { toValue: 0.7 * 0.4, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(glowPulse, { toValue: 0.25, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(glowPulseOuter, { toValue: 0.25 * 0.4, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ]),
      ])
    );
    glowLoop.start();

    const spinLoop = Animated.loop(
      Animated.timing(starSpin, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: false })
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
  const photoItems = itemsWithPhotos.slice(0, 4);
  const duration =
    hunt.startedAt && hunt.completedAt
      ? formatDuration(new Date(hunt.completedAt).getTime() - new Date(hunt.startedAt).getTime())
      : null;

  const handleSaveShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSaving(true);
    try {
      // Capture the static off-screen card (not the animated live screen)
      const uri = await captureRef(cardRef, { format: 'jpg', quality: 0.95 });

      // Save to photo library
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        await MediaLibrary.saveToLibraryAsync(uri);
      }

      // Share as image (works correctly on both iOS and Android)
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Share your hunt recap!' });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not capture the recap card.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Off-screen static card — captured when user taps Save & Share */}
      <View style={styles.offScreen} pointerEvents="none">
        <View ref={cardRef} collapsable={false} style={styles.recapCard}>
          {/* Gold top accent */}
          <View style={styles.recapAccent} />

          {/* Branding */}
          <View style={styles.recapBrandRow}>
            <Text style={styles.recapBrandText}>🪿  LOOT GOOSE</Text>
          </View>

          {/* Hero */}
          <View style={styles.recapHero}>
            <Text style={styles.recapGoose}>🪿</Text>
            <Text style={styles.recapComplete}>HUNT COMPLETE!</Text>
            <Text style={styles.recapTitle}>{hunt.title}</Text>
            <Text style={styles.recapLocation}>📍 {hunt.location}</Text>
          </View>

          {/* Stats */}
          <View style={styles.recapStatsCard}>
            <View style={styles.recapStat}>
              <Text style={styles.recapStatVal}>{hunt.earnedPoints}</Text>
              <Text style={styles.recapStatLbl}>pts</Text>
            </View>
            <View style={styles.recapStatDivider} />
            <View style={styles.recapStat}>
              <Text style={styles.recapStatVal}>{completedItems.length}/{hunt.items.length}</Text>
              <Text style={styles.recapStatLbl}>items</Text>
            </View>
            {duration && (
              <>
                <View style={styles.recapStatDivider} />
                <View style={styles.recapStat}>
                  <Text style={styles.recapStatVal}>{duration}</Text>
                  <Text style={styles.recapStatLbl}>time</Text>
                </View>
              </>
            )}
          </View>

          {/* Photo grid */}
          {photoItems.length > 0 && (
            <View style={styles.recapPhotoGrid}>
              {photoItems.map((item) => (
                <View key={item.id} style={styles.recapPhotoCell}>
                  <Image source={{ uri: item.photoUri }} style={styles.recapPhoto} />
                  <View style={styles.recapPhotoOverlay}>
                    <Text style={styles.recapPhotoName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.recapPhotoPoints}>{item.points}pts</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Watermark */}
          <Text style={styles.recapWatermark}>lootgoose.app</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Animated hero area */}
        <View style={styles.hero}>
          <Animated.View style={[styles.glowRing, { opacity: glowPulse }]} />
          <Animated.View style={[styles.glowRingOuter, { opacity: glowPulseOuter }]} />

          <Animated.View style={[styles.starTL, { transform: [{ rotate: starRotate }] }]}>
            <Text style={styles.starTLText}>✨</Text>
          </Animated.View>
          <Animated.View style={[styles.starTR, { transform: [{ rotate: starRotate }] }]}>
            <Text style={styles.starTRText}>🪙</Text>
          </Animated.View>
          <Animated.View style={[styles.starBL, { transform: [{ rotate: starRotate }] }]}>
            <Text style={styles.starBLText}>🪙</Text>
          </Animated.View>
          <Animated.View style={[styles.starBR, { transform: [{ rotate: starRotate }] }]}>
            <Text style={styles.starBRText}>✨</Text>
          </Animated.View>

          <Animated.View style={{ transform: [{ scale: gooseScale }, { translateY: gooseBounce }], marginBottom: 16 }}>
            <Text style={styles.goose}>🪿</Text>
          </Animated.View>

          <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: titleSlide }] }}>
            <Text style={styles.heroTitle}>HUNT COMPLETE!</Text>
          </Animated.View>
          <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: titleSlide }] }}>
            <Text style={styles.huntTitle}>{hunt.title}</Text>
          </Animated.View>
          <Animated.View style={[styles.huntLocationRow, { opacity: fadeIn, transform: [{ translateY: titleSlide }] }]}>
            <FontAwesome name="map-marker" size={12} color={Colors.textSecondary} />
            <Text style={styles.huntLocation}> {hunt.location}</Text>
          </Animated.View>
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
        <TouchableOpacity
          style={[styles.shareBtn, isSaving && { opacity: 0.6 }]}
          onPress={handleSaveShare}
          activeOpacity={0.8}
          disabled={isSaving}
        >
          <FontAwesome name="image" size={16} color={Colors.gold} />
          <Text style={styles.shareBtnText}>{isSaving ? 'Saving…' : 'Save & Share Card'}</Text>
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

  // Off-screen static card positioning
  offScreen: {
    position: 'absolute',
    left: -10000,
    top: 0,
    width: CARD_WIDTH,
  },

  // Static recap card styles
  recapCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.bg,
    paddingBottom: 24,
  },
  recapAccent: {
    height: 4,
    backgroundColor: Colors.gold,
    marginBottom: 20,
  },
  recapBrandRow: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  recapBrandText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.gold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  recapHero: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  recapGoose: { fontSize: 72, marginBottom: 10 },
  recapComplete: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.green,
    letterSpacing: 2,
    marginBottom: 6,
  },
  recapTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  recapLocation: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  recapStatsCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: `${Colors.gold}44`,
  },
  recapStat: { flex: 1, alignItems: 'center', gap: 3 },
  recapStatVal: { fontSize: 22, fontWeight: '900', color: Colors.gold },
  recapStatLbl: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase' },
  recapStatDivider: { width: 1, backgroundColor: Colors.border },
  recapPhotoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  recapPhotoCell: {
    width: CARD_PHOTO_SIZE,
    height: CARD_PHOTO_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  recapPhoto: { width: '100%', height: '100%' },
  recapPhotoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.62)',
    padding: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
  },
  recapPhotoName: { flex: 1, fontSize: 10, fontWeight: '700', color: '#fff', lineHeight: 13 },
  recapPhotoPoints: { fontSize: 10, fontWeight: '800', color: Colors.gold },
  recapWatermark: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },

  // Animated live screen styles (unchanged)
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
  starTL: { position: 'absolute', top: 52, left: '12%' },
  starTLText: { fontSize: 24 },
  starTR: { position: 'absolute', top: 44, right: '10%' },
  starTRText: { fontSize: 22 },
  starBL: { position: 'absolute', top: 160, left: '8%' },
  starBLText: { fontSize: 20 },
  starBR: { position: 'absolute', top: 152, right: '6%' },
  starBRText: { fontSize: 22 },
  goose: { fontSize: 100 },
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
  huntLocationRow: { flexDirection: 'row', alignItems: 'center' },
  huntLocation: { fontSize: 14, color: Colors.textSecondary },

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
