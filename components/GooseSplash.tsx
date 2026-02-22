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
  const sway = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.3)).current;
  const honkScale = useRef(new Animated.Value(0)).current;
  const honkOpacity = useRef(new Animated.Value(0)).current;
  const coinSpin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entry: fade in + slide text
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(titleSlide, { toValue: 0, duration: 420, delay: 150, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      Animated.timing(tagSlide, { toValue: 0, duration: 420, delay: 260, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
    ]).start();

    // HONK! bubble pops in at 650ms
    const honkTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(honkOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.spring(honkScale, { toValue: 1, friction: 3, tension: 240, useNativeDriver: true }),
      ]).start();
    }, 650);

    // Bounce + squish loop
    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(bounce, { toValue: 0, duration: 75, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(squish, { toValue: 0.78, duration: 75, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.spring(bounce, { toValue: -60, friction: 3.8, tension: 190, useNativeDriver: true }),
          Animated.timing(squish, { toValue: 1, duration: 130, useNativeDriver: true }),
        ]),
        Animated.delay(160),
      ])
    );
    bounceLoop.start();

    // Sway left-right (separate from bounce so they compound)
    const swayLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: -12, duration: 260, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sway, { toValue: 12, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sway, { toValue: 0, duration: 260, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.delay(350),
      ])
    );
    swayLoop.start();

    // Glow ring pulse
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 0.75, duration: 850, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0.22, duration: 850, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    glowLoop.start();

    // Coin spin
    const coinLoop = Animated.loop(
      Animated.timing(coinSpin, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true })
    );
    coinLoop.start();

    // Fade out at 2.6s
    const timer = setTimeout(() => {
      bounceLoop.stop();
      swayLoop.stop();
      glowLoop.stop();
      coinLoop.stop();
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 380,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => onFinished());
    }, 2600);

    return () => {
      clearTimeout(timer);
      clearTimeout(honkTimer);
      bounceLoop.stop();
      swayLoop.stop();
      glowLoop.stop();
      coinLoop.stop();
    };
  }, []);

  const gooseTransform = [
    { translateY: bounce },
    { scaleX: squish.interpolate({ inputRange: [0.78, 1], outputRange: [1.14, 1] }) },
    { scaleY: squish },
    { rotate: sway.interpolate({ inputRange: [-12, 12], outputRange: ['-12deg', '12deg'] }) },
  ];

  const coinRotate = coinSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View style={[styles.container, { opacity: fadeOut }]}>
      {/* Pulsing glow ring */}
      <Animated.View style={[styles.glowRing, { opacity: glowPulse }]} />
      <Animated.View style={[styles.glowRingOuter, { opacity: Animated.multiply(glowPulse, 0.45) as any }]} />

      {/* Spinning coin accents */}
      <Animated.Text style={[styles.coin, styles.coinTL, { transform: [{ rotate: coinRotate }] }]}>🪙</Animated.Text>
      <Animated.Text style={[styles.coin, styles.coinTR, { transform: [{ rotate: coinRotate }] }]}>🪙</Animated.Text>
      <Animated.Text style={[styles.coin, styles.coinBL, { transform: [{ rotate: coinRotate }] }]}>✨</Animated.Text>
      <Animated.Text style={[styles.coin, styles.coinBR, { transform: [{ rotate: coinRotate }] }]}>✨</Animated.Text>

      {/* HONK! speech bubble */}
      <Animated.View style={[styles.honkBubble, { opacity: honkOpacity, transform: [{ scale: honkScale }] }]}>
        <Text style={styles.honkText}>HONK!</Text>
        {/* bubble tail */}
        <View style={styles.honkTail} />
      </Animated.View>

      {/* Goose */}
      <Animated.View style={[styles.gooseWrap, { opacity: fadeIn, transform: gooseTransform }]}>
        <Text style={styles.goose}>🪿</Text>
      </Animated.View>

      {/* Title */}
      <Animated.Text style={[styles.title, { opacity: fadeIn, transform: [{ translateY: titleSlide }] }]}>
        LOOT GOOSE
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { opacity: fadeIn, transform: [{ translateY: tagSlide }] }]}>
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
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 2.5,
    borderColor: Colors.gold,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
  },
  glowRingOuter: {
    position: 'absolute',
    width: 270,
    height: 270,
    borderRadius: 135,
    borderWidth: 1.5,
    borderColor: Colors.gold,
  },

  coin: {
    position: 'absolute',
    fontSize: 26,
  },
  coinTL: { top: '28%', left: '12%' },
  coinTR: { top: '26%', right: '10%' },
  coinBL: { top: '58%', left: '14%' },
  coinBR: { top: '56%', right: '12%' },

  honkBubble: {
    position: 'absolute',
    top: '26%',
    right: '6%',
    backgroundColor: Colors.gold,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderBottomRightRadius: 4,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 8,
  },
  honkText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 2,
  },
  honkTail: {
    position: 'absolute',
    bottom: -10,
    right: 14,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 0,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Colors.gold,
  },

  gooseWrap: {
    marginBottom: 16,
  },
  goose: {
    fontSize: 120,
  },

  title: {
    fontSize: 38,
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
