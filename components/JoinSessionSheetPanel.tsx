import React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, typography } from "@/theme";

type JoinSessionSheetPanelProps = {
  onJoin: (userHash: string) => void;
};

function normalizeHashInput(raw: string): string {
  return raw.replace(/^0x/i, "").replace(/\s/g, "").trim();
}

export default function JoinSessionSheetPanel({ onJoin }: JoinSessionSheetPanelProps) {
  const insets = useSafeAreaInsets();
  const [hashInput, setHashInput] = React.useState("");

  // TEMP (testing): min length 3 for 3-digit share ids — revert: >= 8 for hex hashes.
  const canJoin = normalizeHashInput(hashInput).length >= 3;

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <Text style={styles.title}>PEER USER HASH</Text>
      <Text style={styles.hint}>
        Paste the full share hash you received (hex).
      </Text>
      <TextInput
        value={hashInput}
        onChangeText={setHashInput}
        style={styles.input}
        placeholder="0x… or full hex"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
      />
      <TouchableOpacity
        style={[styles.joinButton, !canJoin && styles.joinButtonDisabled]}
        activeOpacity={0.9}
        disabled={!canJoin}
        onPress={() => onJoin(normalizeHashInput(hashInput))}
      >
        <Text style={styles.joinButtonText}>JOIN</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 4,
    paddingHorizontal: 4,
  },
  title: {
    fontFamily: typography.headline.semiBold,
    fontSize: 13,
    letterSpacing: 1.1,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  hint: {
    fontFamily: typography.body.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    marginBottom: 12,
  },
  input: {
    fontFamily: typography.body.medium,
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.chatBorder,
    borderRadius: 10,
    backgroundColor: "rgba(16, 16, 16, 0.6)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  joinButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.accentGreenSoft,
    backgroundColor: colors.encryptedBadgeBackground,
  },
  joinButtonDisabled: {
    opacity: 0.45,
  },
  joinButtonText: {
    fontFamily: typography.headline.semiBold,
    fontSize: 15,
    letterSpacing: 1.2,
    color: colors.accentGreen,
  },
});
