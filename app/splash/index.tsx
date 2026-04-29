import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PatternBackground from "@/components/PatternBackground";
import { colors, typography } from "@/theme";

const MONO = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

const LOG_LINES = [
  "[OK] LOADING_NETWORK_STACK...",
  "[OK] INITIALIZING_P2P_HANDSHAKE...",
  "[OK] SYNCING_DISTRIBUTED_COMPLETED...",
] as const;

const SPLASH_DURATION_MS = 6200;

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const navigatedRef = useRef(false);

  const progress = useSharedValue(0);
  const glow = useSharedValue(0);
  const scanlineY = useSharedValue(0);
  const blink = useSharedValue(1);
  const flicker = useSharedValue(1);

  const [typedLines, setTypedLines] = useState<string[]>(() =>
    LOG_LINES.map(() => ""),
  );

  useEffect(() => {
    progress.value = withDelay(
      200,
      withTiming(1, {
        duration: 2600,
        easing: Easing.inOut(Easing.cubic),
      }),
    );

    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );

    scanlineY.value = withRepeat(
      withTiming(1, {
        duration: 4200,
        easing: Easing.linear,
      }),
      -1,
      false,
    );

    blink.value = withRepeat(
      withSequence(
        withTiming(0.15, { duration: 520 }),
        withTiming(1, { duration: 520 }),
      ),
      -1,
      false,
    );

    flicker.value = withRepeat(
      withSequence(
        withTiming(0.985, { duration: 80 }),
        withTiming(1, { duration: 120 }),
      ),
      -1,
      false,
    );
  }, [blink, flicker, glow, progress, scanlineY]);

  useEffect(() => {
    let cancelled = false;

    const typeLine = async (lineIndex: number, full: string) => {
      for (let j = 0; j <= full.length; j++) {
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, 22));
        setTypedLines((prev) => {
          const next = [...prev];
          next[lineIndex] = full.slice(0, j);
          return next;
        });
      }
    };

    const runLogs = async () => {
      await new Promise((r) => setTimeout(r, 400));
      for (let i = 0; i < LOG_LINES.length; i++) {
        await typeLine(i, LOG_LINES[i]);
        await new Promise((r) => setTimeout(r, 140));
      }
    };

    runLogs();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      router.replace("/onboarding");
    }, SPLASH_DURATION_MS);
    return () => clearTimeout(t);
  }, [router]);

  const barFillStyle = useAnimatedStyle(() => ({
    width: `${interpolate(progress.value, [0, 1], [0, 100])}%`,
  }));

  const nodeGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.78, 1]),
    transform: [
      {
        scale: interpolate(glow.value, [0, 1], [0.992, 1]),
      },
    ],
  }));

  const scanStyle = useAnimatedStyle(
    () => ({
      transform: [
        {
          translateY: interpolate(
            scanlineY.value,
            [0, 1],
            [-0.08 * windowHeight, windowHeight * 1.08],
          ),
        },
      ],
      opacity: interpolate(
        scanlineY.value,
        [0, 0.08, 0.92, 1],
        [0, 0.35, 0.35, 0],
      ),
    }),
    [windowHeight],
  );

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: blink.value,
  }));

  const rootFlickerStyle = useAnimatedStyle(() => ({
    opacity: flicker.value,
  }));

  const logsDisplay = useMemo(() => {
    const typingLineIndex = typedLines.findIndex(
      (line, idx) => line.length < LOG_LINES[idx].length,
    );
    const cursorLineIndex =
      typingLineIndex >= 0 ? typingLineIndex : LOG_LINES.length - 1;

    return typedLines.map((line, i) => (
      <Text key={LOG_LINES[i]} style={styles.logLine} numberOfLines={1}>
        {line}
        {i === cursorLineIndex ? (
          <Animated.Text style={[styles.cursor, cursorStyle]}>|</Animated.Text>
        ) : null}
      </Text>
    ));
  }, [cursorStyle, typedLines]);

  return (
    <PatternBackground patternSize={10}>
      <Animated.View
        style={[styles.root, rootFlickerStyle, { paddingTop: insets.top + 10 }]}
      >
        <View pointerEvents="none" style={styles.scanlineWrap}>
          <Animated.View style={[styles.scanline, scanStyle]} />
        </View>

        <View style={styles.topLeft}>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.systemActive}>SYSTEM_ACTIVE</Text>
          </View>
          <Text style={styles.metaMuted}>NODE_P2P_v0.0.1</Text>
        </View>

        <View style={styles.centerWrap}>
          <View style={styles.centerBlock}>
            <View style={styles.termIcon}>
              <Text style={styles.termGlyph}>
                {">"}
                <Animated.Text style={[styles.termCursor, cursorStyle]}>
                  _
                </Animated.Text>
              </Text>
            </View>

            <Animated.Text style={[styles.nodeTitle, nodeGlowStyle]}>
              NODE
            </Animated.Text>
            <View style={styles.titleRule} />
            <Text style={styles.booting}>SYSTEM_BOOTING</Text>

            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, barFillStyle]} />
            </View>
          </View>
        </View>

        <View style={styles.logBlock}>{logsDisplay}</View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
          <Text style={styles.footerSmall}>SECURE_PROTOCOL</Text>
          <Text style={styles.footerSmall}>v0.0.1_STABLE</Text>
          <Text style={styles.footerTagline}>NODE_P2P By Aditya </Text>
        </View>
      </Animated.View>
    </PatternBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 20,
    zIndex: 1,
  },
  scanlineWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    zIndex: 2,
  },
  scanline: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "rgba(154, 211, 108, 0.18)",
    shadowColor: colors.accentGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  topLeft: {
    alignSelf: "flex-start",
    gap: 6,
    marginBottom: 28,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.online,
    shadowColor: colors.online,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 8,
  },
  systemActive: {
    fontFamily: MONO,
    fontSize: 13,
    letterSpacing: 1.4,
    color: colors.accentGreen,
  },
  metaMuted: {
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.9,
    color: colors.textMuted,
  },
  centerWrap: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: 8,
    minHeight: 120,
  },
  centerBlock: {
    alignItems: "center",
  },
  termIcon: {
    width: 44,
    height: 38,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    backgroundColor: colors.avatarBackground,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  termGlyph: {
    fontFamily: typography.body.medium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  termCursor: {
    fontFamily: typography.body.medium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  nodeTitle: {
    fontFamily: typography.headline.bold,
    fontSize: 56,
    letterSpacing: 10,
    color: colors.accentGreen,
    textShadowColor: "rgba(154, 211, 108, 0.55)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
    marginBottom: 10,
  },
  titleRule: {
    width: "72%",
    maxWidth: 280,
    height: 2,
    backgroundColor: colors.accentGreenSoft,
    opacity: 0.85,
    marginBottom: 12,
  },
  booting: {
    fontFamily: MONO,
    fontSize: 14,
    letterSpacing: 2,
    color: colors.accentGreen,
    marginBottom: 22,
    opacity: 0.92,
  },
  progressTrack: {
    width: "88%",
    maxWidth: 320,
    height: 10,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    backgroundColor: colors.avatarBackground,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: colors.accentGreenSoft,
    shadowColor: colors.accentGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
  },
  logBlock: {
    alignSelf: "stretch",
    gap: 8,
    marginBottom: 16,
  },
  logLine: {
    fontFamily: MONO,
    fontSize: 12,
    letterSpacing: 0.6,
    color: colors.accentGreenSoft,
    opacity: 0.82,
  },
  cursor: {
    fontFamily: MONO,
    fontSize: 12,
    color: colors.accentGreen,
  },
  footer: {
    alignItems: "flex-end",
    gap: 4,
  },
  footerSmall: {
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.textMuted,
    textAlign: "right",
  },
  footerTagline: {
    marginTop: 10,
    alignSelf: "center",
    fontFamily: typography.headline.medium,
    fontSize: 11,
    letterSpacing: 5,
    color: colors.textSecondary,
    opacity: 0.85,
    textAlign: "center",
  },
});
