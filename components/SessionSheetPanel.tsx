import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, typography } from "@/theme";

type SessionSheetPanelProps = {
  onCreateSession: () => void;
  onJoinSession: () => void;
};

export default function SessionSheetPanel({
  onCreateSession,
  onJoinSession,
}: SessionSheetPanelProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const heroSize = Math.min(132, width * 0.34);

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View
        style={[
          styles.heroCircle,
          { width: heroSize, height: heroSize, borderRadius: heroSize / 2 },
        ]}
      >
        <MaterialCommunityIcons
          name="forum-outline"
          size={heroSize * 0.38}
          color={colors.textPrimary}
        />
      </View>

      <View style={styles.menuCard}>
        <TouchableOpacity
          style={[styles.menuRow, styles.menuRowBorder]}
          activeOpacity={0.85}
          onPress={onCreateSession}
        >
          <View style={styles.menuIconWrap}>
            <MaterialCommunityIcons
              name="account-plus-outline"
              size={22}
              color={colors.textSecondary}
            />
          </View>
          <Text style={styles.menuLabel}>Create a new session</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuRow}
          activeOpacity={0.85}
          onPress={onJoinSession}
        >
          <View style={styles.menuIconWrap}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={20}
              color={colors.textSecondary}
            />
          </View>
          <Text style={styles.menuLabel}>Join a chat session</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  heroCircle: {
    borderWidth: 1,
    borderColor: colors.chatBorder,
    backgroundColor: "rgba(16, 16, 16, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  menuCard: {
    alignSelf: "stretch",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.chatBorder,
    backgroundColor: "rgba(16, 16, 16, 0.55)",
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.panelBorderSoft,
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    backgroundColor: colors.settingIconBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    fontFamily: typography.headline.medium,
    fontSize: 15,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
});
