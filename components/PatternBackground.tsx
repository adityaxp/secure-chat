import React, { ReactNode, useMemo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";

import { colors } from "@/theme";

type PatternBackgroundProps = {
  children: ReactNode;
  patternSize?: number;
};

export default function PatternBackground({
  children,
  patternSize = 10,
}: PatternBackgroundProps) {
  const { width, height } = useWindowDimensions();

  const verticalLines = useMemo(
    () =>
      Array.from(
        { length: Math.ceil(width / patternSize) + 1 },
        (_, i) => i * patternSize,
      ),
    [patternSize, width],
  );

  const horizontalLines = useMemo(
    () =>
      Array.from(
        { length: Math.ceil(height / patternSize) + 1 },
        (_, i) => i * patternSize,
      ),
    [height, patternSize],
  );

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.patternContainer}>
        {verticalLines.map((left) => (
          <View
            key={`v-${left}`}
            style={[styles.patternLineVertical, { left }]}
          />
        ))}
        {horizontalLines.map((top) => (
          <View
            key={`h-${top}`}
            style={[styles.patternLineHorizontal, { top }]}
          />
        ))}
        <View style={styles.patternTint} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  patternContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  patternLineVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.patternLineVertical,
  },
  patternLineHorizontal: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.patternLineHorizontal,
  },
  patternTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.patternOverlayTint,
  },
});
