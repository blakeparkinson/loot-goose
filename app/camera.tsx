import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  PhotoFile,
} from 'react-native-vision-camera';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedProps, runOnJS } from 'react-native-reanimated';
import { File } from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/Colors';
import { useAppStore } from '@/lib/store';
import { verifyPhoto, completeCoopItem, uploadHuntPhoto } from '@/lib/api';

const ReanimatedCamera = Animated.createAnimatedComponent(Camera);

export default function CameraScreen() {
  const {
    huntId,
    itemId,
    coopCode,
    playerName: coopPlayerName,
    itemNameOverride,
    itemDescOverride,
    itemLoreOverride,
    itemPoints,
  } = useLocalSearchParams<{
    huntId: string;
    itemId: string;
    coopCode?: string;
    playerName?: string;
    itemNameOverride?: string;
    itemDescOverride?: string;
    itemLoreOverride?: string;
    itemPoints?: string;
  }>();
  const isCoopMode = !!coopCode;
  const router = useRouter();
  const { hasPermission, requestPermission } = useCameraPermission();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice('back');
  const hunt = useAppStore((s) => s.hunts.find((h) => h.id === huntId));
  const completeItem = useAppStore((s) => s.completeItem);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Zoom state — vision-camera uses absolute zoom values (e.g. 0.5 for ultra-wide, 1.0 for wide)
  const maxZoom = Math.min(device?.maxZoom ?? 5, 5);
  const minZoom = device?.minZoom ?? 1;
  const neutralZoom = device?.neutralZoom ?? 1;
  const zoom = useSharedValue(neutralZoom);
  const zoomOffset = useSharedValue(0);
  const [displayZoom, setDisplayZoom] = useState(neutralZoom);

  // Reset zoom when device changes
  useEffect(() => {
    if (device) {
      zoom.value = device.neutralZoom;
      setDisplayZoom(device.neutralZoom);
    }
  }, [device]);

  const updateDisplayZoom = useCallback((value: number) => {
    setDisplayZoom(value);
  }, []);

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      zoomOffset.value = zoom.value;
    })
    .onUpdate((event) => {
      const scale = event.scale;
      const next = zoomOffset.value * scale;
      const clamped = Math.min(maxZoom, Math.max(minZoom, next));
      zoom.value = clamped;
      runOnJS(updateDisplayZoom)(clamped);
    });

  const animatedProps = useAnimatedProps(() => ({
    zoom: zoom.value,
  }));

  // For co-op joiners (no local hunt), fall back to inline item data from route params
  const item = hunt?.items.find((i) => i.id === itemId) ?? (
    itemNameOverride
      ? {
          id: itemId,
          name: itemNameOverride,
          description: itemDescOverride ?? '',
          lore: itemLoreOverride ?? '',
          points: Number(itemPoints ?? 0),
          completed: false,
        }
      : undefined
  );

  useEffect(() => {
    if (!hasPermission) requestPermission();
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

  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <TouchableOpacity
          style={{ position: 'absolute', top: insets.top + 12, left: 16, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <FontAwesome name="chevron-left" size={14} color={Colors.text} />
          <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '600' }}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.permText}>Camera access is needed to capture hunt items.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission} accessibilityRole="button" accessibilityLabel="Grant camera access">
          <Text style={styles.permBtnText}>Grant Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.gold} size="large" />
        <Text style={{ color: Colors.textSecondary, marginTop: 12 }}>Loading camera...</Text>
      </View>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing || isVerifying) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsCapturing(true);

    try {
      const photo: PhotoFile = await cameraRef.current.takePhoto();
      const photoUri = `file://${photo.path}`;
      setIsCapturing(false);
      setCapturedUri(photoUri);
      setIsVerifying(true);

      const imageBase64 = await new File(photoUri).base64();
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
          try {
            await completeCoopItem({
              code: coopCode!,
              itemId,
              playerName: coopPlayerName!,
              verificationNote: verification.message,
            });
          } catch (e: any) {
            if (!e.message?.includes('409') && !e.message?.includes('Already') && !e.message?.includes('alreadyCompleted')) {
              throw e;
            }
          }
        } else {
          let persistentUri = photoUri;
          try {
            persistentUri = await uploadHuntPhoto(imageBase64, huntId, itemId);
          } catch {
            // Upload failed (offline, etc.) — fall back to local URI
          }
          const isLastItem = hunt!.items.filter((i) => !i.completed && i.id !== itemId).length === 0;
          await completeItem(huntId, itemId, persistentUri, verification.message);
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

  const summaryText = item.lore ?? item.hint;
  const summaryBar = summaryText ? (
    <View style={styles.summaryBar}>
      <FontAwesome name="book" size={13} color={Colors.gold} />
      <Text style={styles.summaryText} numberOfLines={3}>{summaryText}</Text>
    </View>
  ) : null;

  // After capture: show the frozen photo with overlays
  if (capturedUri) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: capturedUri }} style={styles.frozenPhoto} resizeMode="cover" />
        {topBar}

        {isVerifying && (
          <View style={styles.verifyingOverlay}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={styles.verifyingTitle}>Checking your photo…</Text>
            <Text style={styles.verifyingSubtitle}>The goose is on it</Text>
          </View>
        )}

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
      <GestureDetector gesture={pinchGesture}>
        <View style={styles.camera}>
          <ReanimatedCamera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
            photo={true}
            animatedProps={animatedProps}
          />
          {topBar}
          {summaryBar}

          {Math.abs(displayZoom - neutralZoom) > 0.05 && (
            <View style={styles.zoomBadge}>
              <Text style={styles.zoomText}>{displayZoom.toFixed(1)}x</Text>
            </View>
          )}

          <View style={[styles.captureRow, { bottom: insets.bottom + 24 }]}>
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
        </View>
      </GestureDetector>
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

  summaryBar: {
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
  summaryText: { flex: 1, color: Colors.gold, fontSize: 13, lineHeight: 18 },

  zoomBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 8,
  },
  zoomText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  captureRow: {
    position: 'absolute',
    bottom: 24,
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
