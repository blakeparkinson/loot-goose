import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import Colors from '@/constants/Colors';

interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}

export function Skeleton({ width, height, borderRadius = 8, style }: SkeletonProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [Colors.surface, Colors.border],
    ),
  }));

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius },
        animatedStyle,
        style,
      ]}
      accessibilityRole="none"
    />
  );
}

export function HuntCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Skeleton width="60%" height={18} borderRadius={6} />
        <Skeleton width={60} height={22} borderRadius={8} />
      </View>
      <Skeleton width="40%" height={14} borderRadius={4} style={{ marginBottom: 12 }} />
      <Skeleton width="100%" height={6} borderRadius={3} style={{ marginBottom: 10 }} />
      <View style={styles.cardBottom}>
        <Skeleton width={70} height={12} borderRadius={4} />
        <Skeleton width={80} height={12} borderRadius={4} />
      </View>
    </View>
  );
}

export function ChallengeCardSkeleton() {
  return (
    <View style={styles.challengeCard}>
      <Skeleton width={120} height={12} borderRadius={4} style={{ marginBottom: 12 }} />
      <Skeleton width="80%" height={20} borderRadius={6} style={{ marginBottom: 8 }} />
      <Skeleton width="100%" height={14} borderRadius={4} style={{ marginBottom: 4 }} />
      <Skeleton width="60%" height={14} borderRadius={4} />
    </View>
  );
}

export function FeaturedStripSkeleton() {
  return (
    <View style={styles.featuredStrip}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.featuredCardSkeleton}>
          <Skeleton width={70} height={10} borderRadius={4} style={{ marginBottom: 10 }} />
          <Skeleton width="90%" height={16} borderRadius={5} style={{ marginBottom: 8 }} />
          <Skeleton width="70%" height={12} borderRadius={4} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  challengeCard: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  featuredStrip: {
    flexDirection: 'row',
    gap: 10,
  },
  featuredCardSkeleton: {
    width: 210,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
