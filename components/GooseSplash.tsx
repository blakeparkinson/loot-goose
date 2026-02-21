import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, Easing } from 'react-native';
import Colors from '@/constants/Colors';

interface Props {
  onFinished: () => void;
}

export default function GooseSplash({ onFinished }: Props) {
  const bounce = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(30)).current;
  const tagSlide = useRef(new Animated.Value(20)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;
  const squish = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entry: fade in + bounce goose + slide in text
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(titleSlide, { toValue: 0, duration: 400, delay: 150, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      Animated.timing(tagSlide, { toValue: 0, duration: 400, delay: 250, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
    ]).start();

    // Bouncy honk loop
    const bounceLoop = Animated.loop(
      Animated.sequence([
        // Squish down as goose lands
        Animated.parallel([
          Animated.timing(bounce, { toValue: 0, duration: 80, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(squish, { toValue: 0.82, duration: 80, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
        // Pop back up
        Animated.parallel([
          Animated.spring(bounce, { toValue: -55, friction: 4, tension: 180, useNativeDriver: true }),
          Animated.timing(squish, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]),
        Animated.delay(180),
      ])
    );

    bounceLoop.start();

    // Fade out after 2.2s
    const timer = setTimeout(() => {
      bounceLoop.stop();
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 380,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => onFinished());
    }, 2200);

    return () => {
      clearTimeout(timer);
      bounceLoop.stop();
    };
  }, []);

  const gooseTransform = [
    { translateY: bounce },
    { scaleX: squish.interpolate({ inputRange: [0.82, 1], outputRange: [1.1, 1] }) },
    { scaleY: squish },
  ];

  return (
    <Animated.View style={[styles.container, { opacity: fadeOut }]}>
      {/* Glow ring */}
      <View style={styles.glowRing} />

      {/* Goose */}
      <Animated.View style={[styles.gooseWrap, { opacity: fadeIn, transform: gooseTransform }]}>
        <Text style={styles.goose}>🪿</Text>
      </Animated.View>

      {/* Title */}
      <Animated.Text
        style={[styles.title, { opacity: fadeIn, transform: [{ translateY: titleSlide }] }]}
      >
        LOOT GOOSE
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text
        style={[styles.tagline, { opacity: fadeIn, transform: [{ translateY: tagSlide }] }]}
      >
        HONK if you found it
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  glowRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: `${Colors.gold}30`,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 40,
  },
  gooseWrap: {
    marginBottom: 20,
  },
  goose: {
    fontSize: 120,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.gold,
    letterSpacing: 3,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
});
