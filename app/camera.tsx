import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import Colors from '@/constants/Colors';
import { useAppStore } from '@/lib/store';
import { verifyPhoto } from '@/lib/api';

export default function CameraScreen() {
  const { huntId, itemId } = useLocalSearchParams<{ huntId: string; itemId: string }>();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const getHunt = useAppStore((s) => s.getHunt);
  const completeItem = useAppStore((s) => s.completeItem);

  const [isCapturing, setIsCapturing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const hunt = getHunt(huntId);
  const item = hunt?.items.find((i) => i.id === itemId);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  if (!hunt || !item) {
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

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing || isVerifying) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsCapturing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6, base64: true });
      if (!photo) throw new Error('No photo captured');
      setIsCapturing(false);
      setIsVerifying(true);

      const imageBase64 = photo.base64 ?? '';
      const verification = await verifyPhoto({
        imageBase64,
        itemName: item.name,
        itemDescription: item.description,
        location: hunt.location,
      });

      setResult(verification);

      if (verification.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await completeItem(huntId, itemId, photo.uri, verification.message);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (e: any) {
      setIsCapturing(false);
      setIsVerifying(false);
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
  };

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        {/* Top overlay */}
        <View style={styles.topOverlay}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <FontAwesome name="times" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={styles.itemBadge}>
            <Text style={styles.itemBadgeName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.itemBadgePoints}>{item.points}pts</Text>
          </View>
        </View>

        {/* Hint */}
        <View style={styles.hintBar}>
          <FontAwesome name="lightbulb-o" size={13} color={Colors.gold} />
          <Text style={styles.hintText} numberOfLines={2}>{item.hint}</Text>
        </View>

        {/* Result overlay */}
        {result && (
          <View style={[styles.resultOverlay, { backgroundColor: result.success ? 'rgba(63,185,80,0.92)' : 'rgba(248,81,73,0.92)' }]}>
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

        {/* Capture button */}
        {!result && (
          <View style={styles.captureRow}>
            {isCapturing || isVerifying ? (
              <View style={styles.captureBtnOuter}>
                <ActivityIndicator color={Colors.gold} size="large" />
                <Text style={styles.verifyingText}>
                  {isCapturing ? 'Capturing...' : 'Verifying with AI...'}
                </Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.captureBtnOuter} onPress={handleCapture} activeOpacity={0.8}>
                <View style={styles.captureBtnInner} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  centered: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },

  topOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
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

  captureRow: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 60 : 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 10,
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
  verifyingText: { color: '#fff', marginTop: 8, fontSize: 13, fontWeight: '600' },

  resultOverlay: {
    position: 'absolute',
    inset: 0,
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
