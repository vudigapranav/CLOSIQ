import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  AccessibilityInfo,
  useWindowDimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Cinematic launch intro (2026-10-13) — the mobile twin of the web
 * SplashScreen (src/components/ui/SplashScreen.tsx + index.css).
 *
 * Full film, once a day per device: letterbox bars → warm light through the
 * door seam → almirah doors swing open → logo comes into focus → tagline →
 * gold rule → bars retract. Other launches get a short "lite" cut; reduced
 * motion gets a plain fade. Tap anywhere to skip. Official logo asset only;
 * the doors, light and bars are plain shapes. Native-driver animations only.
 */

const FULL_INTRO_KEY = '@closiq_intro_full_date';

const C = {
  charcoal: '#14110E',
  door: '#E9DFCC',
  doorEdge: '#DCCFB6',
  brass: '#8A7754',
  light: '#F3D9A4',
  ivory: '#F7F2E9',
  olive: '#6B5A3D',
  logoPlate: '#F5F6F2'
};

type Variant = 'full' | 'lite' | 'reduced';

interface IntroSplashProps {
  onFinish: () => void;
}

export const IntroSplash: React.FC<IntroSplashProps> = ({ onFinish }) => {
  const { width, height } = useWindowDimensions();
  const [variant, setVariant] = useState<Variant | null>(null);

  const bars = useRef(new Animated.Value(0)).current;
  const seam = useRef(new Animated.Value(0)).current;
  const doors = useRef(new Animated.Value(0)).current;
  const logo = useRef(new Animated.Value(0)).current;
  const tagline = useRef(new Animated.Value(0)).current;
  const rule = useRef(new Animated.Value(0)).current;
  const exitAnim = useRef(new Animated.Value(1)).current;

  const finished = useRef(false);
  const running = useRef<Animated.CompositeAnimation | null>(null);

  const exit = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    running.current?.stop();
    Animated.parallel([
      Animated.timing(exitAnim, { toValue: 0, duration: variant === 'reduced' ? 200 : 600, useNativeDriver: true }),
      Animated.timing(bars, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.cubic), useNativeDriver: true })
    ]).start(() => onFinish());
  }, [bars, exitAnim, onFinish, variant]);

  // Decide which cut to play: full once per calendar day, otherwise lite.
  useEffect(() => {
    let active = true;
    (async () => {
      let next: Variant = 'full';
      try {
        if (await AccessibilityInfo.isReduceMotionEnabled()) next = 'reduced';
        else {
          const today = new Date().toDateString();
          if ((await AsyncStorage.getItem(FULL_INTRO_KEY)) === today) next = 'lite';
          else await AsyncStorage.setItem(FULL_INTRO_KEY, today);
        }
      } catch {
        // Storage unavailable: just play the full film.
      }
      if (active) setVariant(next);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!variant) return;
    const ease = Easing.bezier(0.16, 1, 0.3, 1);
    const swing = Easing.bezier(0.65, 0, 0.35, 1);
    const t = (value: Animated.Value, toValue: number, duration: number, delay: number, easing = ease) =>
      Animated.timing(value, { toValue, duration, delay, easing, useNativeDriver: true });

    let film: Animated.CompositeAnimation;
    let holdMs: number;
    if (variant === 'full') {
      film = Animated.parallel([
        t(bars, 1, 450, 0),
        Animated.sequence([t(seam, 1, 500, 350, Easing.out(Easing.quad)), t(seam, 0, 350, 300, Easing.in(Easing.quad))]),
        t(doors, 1, 1000, 900, swing),
        t(logo, 1, 1100, 1450),
        t(tagline, 1, 1000, 2100),
        t(rule, 1, 700, 2550, swing)
      ]);
      holdMs = 3600;
    } else if (variant === 'lite') {
      film = Animated.parallel([t(bars, 1, 400, 0), t(logo, 1, 700, 150), t(tagline, 1, 600, 450), t(rule, 1, 500, 650, swing)]);
      holdMs = 1300;
    } else {
      logo.setValue(1);
      tagline.setValue(1);
      rule.setValue(1);
      film = Animated.delay(0);
      holdMs = 700;
    }
    running.current = film;
    film.start();
    const timer = setTimeout(exit, holdMs);
    return () => clearTimeout(timer);
  }, [variant, bars, seam, doors, logo, tagline, rule, exit]);

  const barHeight = Math.round(height * 0.1);
  const logoWidth = Math.min(width * 0.62, 280);
  const doorRotate = (sign: 1 | -1) =>
    doors.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${sign * 96}deg`] });
  const doorShade = doors.interpolate({ inputRange: [0, 1], outputRange: [0, 0.3] });

  const renderDoor = (side: 'left' | 'right') => (
    <Animated.View
      style={[
        styles.door,
        side === 'left' ? { left: 0, transformOrigin: 'left center' } : { right: 0, transformOrigin: 'right center' },
        { width: width / 2, transform: [{ perspective: 1600 }, { rotateY: doorRotate(side === 'left' ? -1 : 1) }] }
      ]}
    >
      <View style={[styles.doorEdge, side === 'left' ? { left: 0 } : { right: 0 }]} />
      <View style={[styles.panel, { top: '9%', bottom: '52%' }]} />
      <View style={[styles.panel, { top: '56%', bottom: '9%' }]} />
      <View style={[styles.handle, side === 'left' ? { right: '7%' } : { left: '7%' }]} />
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: doorShade }]} />
    </Animated.View>
  );

  return (
    <Pressable style={styles.root} onPress={exit} accessibilityLabel="Skip intro">
      <StatusBar barStyle="light-content" backgroundColor={C.charcoal} />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: exitAnim }]}>
        {/* The lit studio behind the doors */}
        <View style={styles.stage}>
          <View style={[styles.spotlight, { width: width * 1.3, height: width * 1.3, borderRadius: width * 0.65 }]} />
          <Animated.View
            style={{
              opacity: logo,
              transform: [
                { translateY: logo.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
                { scale: logo.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1] }) }
              ]
            }}
          >
            <View style={styles.logoPlate}>
              <Image
                source={require('../../assets/closiq-logo.png')}
                style={{ width: logoWidth, height: logoWidth * 0.28 }}
                resizeMode="contain"
              />
            </View>
          </Animated.View>
          <Animated.Text
            style={[
              styles.tagline,
              {
                opacity: tagline,
                transform: [{ translateY: tagline.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }]
              }
            ]}
          >
            STYLE WHAT YOU ALREADY OWN
          </Animated.Text>
          <Animated.View style={[styles.rule, { transform: [{ scaleX: rule }] }]} />
        </View>

        {variant === 'full' && (
          <>
            {renderDoor('left')}
            {renderDoor('right')}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.seam,
                { left: width / 2 - 1, opacity: seam, transform: [{ scaleY: seam }] }
              ]}
            />
          </>
        )}

        {/* Before the cut is chosen, hold a closed-doors frame so nothing flashes. */}
        {variant === null && <View style={[StyleSheet.absoluteFill, { backgroundColor: C.door }]} />}
      </Animated.View>

      {variant !== 'reduced' && (
        <>
          <Animated.View
            style={[
              styles.bar,
              { top: 0, height: barHeight, transform: [{ translateY: bars.interpolate({ inputRange: [0, 1], outputRange: [-barHeight, 0] }) }] }
            ]}
          />
          <Animated.View
            style={[
              styles.bar,
              styles.barBottom,
              { bottom: 0, height: barHeight, transform: [{ translateY: bars.interpolate({ inputRange: [0, 1], outputRange: [barHeight, 0] }) }] }
            ]}
          >
            <Text style={styles.skip}>TAP TO SKIP</Text>
          </Animated.View>
        </>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.charcoal,
    overflow: 'hidden'
  },
  stage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#ECE2D0',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22
  },
  spotlight: {
    position: 'absolute',
    backgroundColor: C.ivory,
    opacity: 0.9
  },
  logoPlate: {
    backgroundColor: C.logoPlate,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 18,
    shadowColor: '#2B2723',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6
  },
  tagline: {
    fontSize: 13,
    fontStyle: 'italic',
    fontWeight: '600',
    letterSpacing: 3.2,
    color: C.olive,
    textAlign: 'center',
    paddingHorizontal: 24
  },
  rule: {
    width: 128,
    height: 1,
    backgroundColor: C.brass
  },
  door: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: C.door,
    backfaceVisibility: 'hidden',
    overflow: 'hidden'
  },
  doorEdge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 14,
    backgroundColor: C.doorEdge
  },
  panel: {
    position: 'absolute',
    left: '14%',
    right: '14%',
    borderWidth: 1,
    borderColor: 'rgba(43, 39, 35, 0.12)',
    borderRadius: 6
  },
  handle: {
    position: 'absolute',
    top: '44%',
    width: 6,
    height: '12%',
    borderRadius: 3,
    backgroundColor: C.brass
  },
  seam: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: C.light,
    shadowColor: C.light,
    shadowOpacity: 0.9,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: C.charcoal
  },
  barBottom: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  skip: {
    fontSize: 10,
    letterSpacing: 2,
    color: 'rgba(245, 239, 228, 0.45)'
  }
});
