import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import Colors from '@/constants/Colors';
import { useAppStore, hintPenalty } from '@/lib/store';
import { verifyPhoto, completeCoopItem } from '@/lib/api';

export default function CameraScreen() {
  const {
    huntId,
    itemId,
    coopCode,
    playerName: coopPlayerName,
    itemNameOverride,
    itemDescOverride,
    itemHintOverride,
    itemPoints,
  } = useLocalSearchParams<{
    huntId: string;
    itemId: string;
    coopCode?: string;
    playerName?: string;
    itemNameOverride?: string;
    itemDescOverride?: string;
    itemHintOverride?: string;
    itemPoints?: string;
  }>();
  const isCoopMode = !!coopCode;
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const hunt = useAppStore((s) => s.hunts.find((h) => h.id === huntId));
  const completeItem = useAppStore((s) => s.completeItem);
  const revealHint = useAppStore((s) => s.revealHint);


  const [isRevealingHint, setIsRevealingHint] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  // For co-op joiners (no local hunt), fall back to inline item data from route params
  const item = hunt?.items.find((i) => i.id === itemId) ?? (
    itemNameOverride
      ? {
          id: itemId,
          name: itemNameOverride,
          description: itemDescOverride ?? '',
          hint: itemHintOverride ?? '',
          points: Number(itemPoints ?? 0),
          completed: false,
          hintRevealed: false as boolean | undefined,
        }
      : undefined
  );

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  if ((!hunt && !isCoopMode) || !item) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: Colors.text }}>Item not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ color: Colors.gold }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!permission?.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permText}>Camera access is needed to capture hunt items.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleRevealHint = () => {
    if (!item) return;
    const penalty = hintPenalty({ ...item, hintRevealed: true });
    Alert.alert(
      'Reveal Hint?',
      `This will cost you ${penalty} pts at completion.`,
      [
        { text: 'Keep it locked', style: 'cancel' },
        {
          text: `Reveal (−${penalty}pts)`,
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setIsRevealingHint(true);
            try {
              await revealHint(huntId, itemId);
            } finally {
              setIsRevealingHint(false);
            }
          },
        },
      ],
    );
  };

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing || isVerifying) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsCapturing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6, base64: true });
      if (!photo) throw new Error('No photo captured');
      setIsCapturing(false);
      setCapturedUri(photo.uri);
      setIsVerifying(true);

      const imageBase64 = photo.base64 ?? '';
      const verification = await verifyPhoto({
        imageBase64,
        itemName: item.name,
        itemDescription: item.description,
        location: hunt?.location ?? item.sublocation ?? '',
      });

      setResult(verification);

      if (verification.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (isCoopMode) {
          // Co-op path — write to Supabase, not Zustand. Realtime updates the coop screen.
          try {
            await completeCoopItem({
              code: coopCode!,
              itemId,
              playerName: coopPlayerName!,
              verificationNote: verification.message,
            });
          } catch (e: any) {
            // 409 means someone else completed it first — navigate back anyway
            if (!e.message?.includes('409') && !e.message?.includes('Already') && !e.message?.includes('alreadyCompleted')) {
              throw e;
            }
          }
          // router.back() falls through to handleDone; the coop screen updates via Realtime
        } else {
          // Solo path — existing behavior
          const isLastItem = hunt!.items.filter((i) => !i.completed && i.id !== itemId).length === 0;
          await completeItem(huntId, itemId, photo.uri, verification.message);
          if (isLastItem) {
            router.replace({ pathname: '/hunt/complete', params: { id: huntId } });
            return;
          }
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (e: any) {
      setIsCapturing(false);
      setIsVerifying(false);
      setCapturedUri(null);
      Alert.alert('Error', e.message || 'Something went wrong. Try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDone = () => {
    router.back();
  };

  const handleRetry = () => {
    setResult(null);
    setCapturedUri(null);
  };

  const topBar = (
    <View style={[styles.topOverlay, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
        <FontAwesome name="times" size={20} color="#fff" />
      </TouchableOpacity>
      <View style={styles.itemBadge}>
        <Text style={styles.itemBadgeName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.itemBadgePoints}>{item.points}pts</Text>
      </View>
    </View>
  );

  // In co-op mode hints are hidden (no Zustand to persist penalty state)
  const hintBar = isCoopMode ? null : item.hintRevealed ? (
    <View style={styles.hintBar}>
      <FontAwesome name="lightbulb-o" size={13} color={Colors.gold} />
      <Text style={styles.hintText} numberOfLines={2}>{item.hint}</Text>
      <View style={styles.hintPenaltyBadge}>
        <Text style={styles.hintPenaltyText}>−{hintPenalty(item)}pts</Text>
      </View>
    </View>
  ) : (
    <TouchableOpacity
      style={[styles.hintBar, styles.hintBarLocked]}
      onPress={handleRevealHint}
      disabled={isRevealingHint}
      activeOpacity={0.7}
    >
      {isRevealingHint
        ? <ActivityIndicator size="small" color={Colors.gold} />
        : <FontAwesome name="lock" size={13} color={Colors.gold} />
      }
      <Text style={styles.hintText} numberOfLines={1}>
        {isRevealingHint ? 'Revealing...' : `Tap to reveal hint · −${hintPenalty({ ...item, hintRevealed: true })}pts`}
      </Text>
    </TouchableOpacity>
  );

  // After capture: show the frozen photo with overlays
  if (capturedUri) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: capturedUri }} style={styles.frozenPhoto} resizeMode="cover" />
        {topBar}

        {/* Verifying overlay */}
        {isVerifying && (
          <View style={styles.verifyingOverlay}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={styles.verifyingTitle}>Checking your photo…</Text>
            <Text style={styles.verifyingSubtitle}>The goose is on it</Text>
          </View>
        )}

        {/* Result overlay */}
        {result && (
          <View style={[styles.resultOverlay, { backgroundColor: result.success ? 'rgba(34,139,34,0.88)' : 'rgba(180,40,40,0.88)' }]}>
            <Text style={styles.resultEmoji}>{result.success ? '🎉' : '❌'}</Text>
            <Text style={styles.resultTitle}>{result.success ? 'Found it!' : 'Not quite...'}</Text>
            <Text style={styles.resultMessage}>{result.message}</Text>
            {result.success ? (
              <TouchableOpacity style={styles.resultBtn} onPress={handleDone}>
                <Text style={styles.resultBtnText}>Back to Hunt</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.resultBtn} onPress={handleRetry}>
                <Text style={styles.resultBtnText}>Try Again</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  }

  // Live camera view
  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        {topBar}
        {hintBar}

        {/* Capture button */}
        <View style={styles.captureRow}>
          {isCapturing ? (
            <View style={styles.captureBtnOuter}>
              <ActivityIndicator color={Colors.gold} size="large" />
            </View>
          ) : (
            <TouchableOpacity style={styles.captureBtnOuter} onPress={handleCapture} activeOpacity={0.8}>
              <View style={styles.captureBtnInner} />
            </TouchableOpacity>
          )}
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  frozenPhoto: { ...StyleSheet.absoluteFillObject },
  centered: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },

  topOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBadge: { flex: 1, gap: 2 },
  itemBadgeName: { fontSize: 16, fontWeight: '800', color: '#fff' },
  itemBadgePoints: { fontSize: 13, color: Colors.gold, fontWeight: '700' },

  hintBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    margin: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: `${Colors.gold}44`,
  },
  hintText: { flex: 1, color: Colors.gold, fontSize: 13, lineHeight: 18 },
  hintBarLocked: { opacity: 0.85 },
  hintPenaltyBadge: {
    backgroundColor: 'rgba(248,81,73,0.25)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  hintPenaltyText: { fontSize: 10, fontWeight: '700', color: '#f85149' },

  captureRow: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 60 : 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureBtnOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtnInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
  },

  verifyingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  verifyingTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  verifyingSubtitle: { color: 'rgba(255,255,255,0.65)', fontSize: 14, fontWeight: '500' },

  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  resultEmoji: { fontSize: 64 },
  resultTitle: { fontSize: 28, fontWeight: '900', color: '#fff' },
  resultMessage: { fontSize: 15, color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 22 },
  resultBtn: {
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  resultBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  permText: { color: Colors.textSecondary, textAlign: 'center', marginBottom: 20, fontSize: 15 },
  permBtn: { backgroundColor: Colors.gold, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  permBtnText: { fontWeight: '800', color: '#000', fontSize: 15 },
  backBtn: { marginTop: 16 },
});
