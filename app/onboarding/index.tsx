import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { userImageXX, userImageXY } from "@/assets/images";
import PatternBackground from "@/components/PatternBackground";
import { startInternetNode } from "@/services/internetNode";
import { useUserStore } from "@/store/UserStore";
import { colors, typography } from "@/theme";
import { createUserShareHash, randomEntropyHex } from "@/utils/hash";
import { router } from "expo-router";

const AVATARS = [
  { id: "XX" as const, source: userImageXX },
  { id: "XY" as const, source: userImageXY },
];

const UPLINK_OPTIONS = [
  {
    key: "internet" as const,
    title: "INTERNET_NODE",
    description: "Requires an active internet connection",
    icon: "earth" as const,
  },
  {
    key: "local" as const,
    title: "LOCAL_NODE",
    description: "Offline P2P communication",
    icon: "lan-connect" as const,
  },
];

function randomDisplayName(): string {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `NODE_${suffix}`;
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const headerCursorOpacity = useSharedValue(1);
  const [displayName, setDisplayName] = useState(randomDisplayName());
  const { setUser } = useUserStore();
  const [uplink, setUplink] = useState<"internet" | "local">("internet");

  const [userType, setUserType] = useState<"XX" | "XY">("XX");

  React.useEffect(() => {
    headerCursorOpacity.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 500 }),
        withTiming(1, { duration: 500 }),
      ),
      -1,
      false,
    );
  }, [headerCursorOpacity]);

  const headerCursorStyle = useAnimatedStyle(() => ({
    opacity: headerCursorOpacity.value,
  }));

  const regenerateName = useCallback(() => {
    setDisplayName(randomDisplayName());
  }, []);

  const onCompleteSetup = async () => {
    const entropyHex = await randomEntropyHex(16);
    const userHash = await createUserShareHash({
      userId: displayName,
      userType,
      uplinkType: uplink,
      entropyHex,
    });

    const user = {
      userId: displayName,
      userType: userType,
      uplinkType: uplink,
      userHash: userHash,
    };
    setUser(user);

    if (uplink === "internet") {
      startInternetNode(user);
    }

    console.log("user created", user);

    router.replace("/user");
  };

  return (
    <PatternBackground patternSize={10}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerIconBox}>
            <Text style={styles.headerIconGlyph}>
              {">"}
              <Animated.Text
                style={[
                  styles.headerIconGlyph,
                  styles.headerIconCursor,
                  headerCursorStyle,
                ]}
              >
                _
              </Animated.Text>
            </Text>
          </View>
          <Text style={styles.headerTitle}>Setup Node</Text>
        </View>
        <View style={styles.headerDivider} />

        <View style={styles.avatarRow}>
          {AVATARS.map((item, index) => {
            const selected = userType === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.85}
                onPress={() => setUserType(item.id)}
                style={[
                  styles.avatarTile,
                  selected && styles.avatarTileSelected,
                ]}
              >
                <Image
                  source={item.source}
                  style={styles.avatarImage}
                  contentFit="contain"
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.nameField}>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Node display name"
            placeholderTextColor={colors.textMuted}
            style={styles.nameInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            onPress={regenerateName}
            hitSlop={12}
            style={styles.regenButton}
          >
            <Feather
              name="refresh-ccw"
              size={16}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.uplinkLabel}>
          <Text style={styles.uplinkLabelText}>SELECT_UPLINK</Text>
        </View>

        <View style={styles.uplinkRow}>
          {UPLINK_OPTIONS.map((opt) => {
            const selected = uplink === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                activeOpacity={0.88}
                onPress={() => setUplink(opt.key)}
                style={[
                  styles.uplinkCardOuter,
                  selected && styles.uplinkCardOuterSelected,
                ]}
              >
                <LinearGradient
                  colors={[colors.panelGradientStart, colors.panelGradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.uplinkCard}
                >
                  <View style={styles.uplinkCardHeader}>
                    <View style={styles.uplinkTitleRow}>
                      <Text style={styles.uplinkTitle}>{opt.title}</Text>
                      {opt.key === "local" ? (
                        <View style={styles.bluetoothRequired}>
                          <MaterialCommunityIcons
                            name="bluetooth"
                            size={14}
                            color={colors.accentGreen}
                          />
                          <Text style={styles.bluetoothRequiredText}>
                            REQUIRED
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <MaterialCommunityIcons
                      name={opt.icon}
                      size={22}
                      color={!selected ? colors.textSecondary : colors.online}
                    />
                  </View>
                  <Text style={styles.uplinkDescription}>
                    {opt.description}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onCompleteSetup}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Complete Setup</Text>
        </TouchableOpacity>

        <View style={styles.footerNote}>
          <Ionicons
            name="information-circle"
            size={18}
            color={colors.textMuted}
          />
          <Text style={styles.footerText}>
            Once the setup is complete, a node will be created and a secret key
            will be assigned to you.
          </Text>
        </View>
      </ScrollView>
    </PatternBackground>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    zIndex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  headerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: colors.avatarBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconGlyph: {
    fontFamily: typography.body.medium,
    fontSize: 14,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  headerIconCursor: {
    letterSpacing: 0,
  },
  headerTitle: {
    fontFamily: typography.headline.bold,
    fontSize: 22,
    color: colors.textPrimary,
    letterSpacing: 0.4,
  },
  headerDivider: {
    height: 1,
    backgroundColor: colors.panelBorder,
    marginBottom: 22,
  },
  avatarRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginBottom: 20,
  },
  avatarTile: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.panelBorder,
    backgroundColor: colors.avatarBackground,
    overflow: "hidden",
    padding: 8,
  },
  avatarTileSelected: {
    borderColor: colors.avatarFrameBorder,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  nameField: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: 14,
    backgroundColor: colors.panel,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 22,
    minHeight: 52,
  },
  nameInput: {
    flex: 1,
    fontFamily: typography.headline.medium,
    fontSize: 17,
    color: colors.textPrimary,
    letterSpacing: 0.3,
    paddingVertical: 10,
  },
  regenButton: {
    width: 35,
    height: 35,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    backgroundColor: colors.settingIconBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  uplinkLabel: {
    alignSelf: "flex-start",
    backgroundColor: colors.avatarBackground,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  uplinkLabelText: {
    fontFamily: typography.headline.medium,
    fontSize: 11,
    color: colors.textPrimary,
    letterSpacing: 1.3,
  },
  uplinkRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 26,
  },
  uplinkCardOuter: {
    flex: 1,
    borderRadius: 12,
  },
  uplinkCardOuterSelected: {
    borderColor: colors.accentGreenSoft,
    borderWidth: 2,
  },
  uplinkCard: {
    padding: 10,
    height: 100,
    borderRadius: 12,
  },
  uplinkCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 6,
  },
  uplinkTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  uplinkTitle: {
    fontFamily: typography.headline.medium,
    fontSize: 12,
    color: colors.textPrimary,
    letterSpacing: 0.9,
  },
  bluetoothRequired: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.accentGreenSoft,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  bluetoothRequiredText: {
    fontFamily: typography.headline.medium,
    fontSize: 9,
    color: colors.accentGreen,
    letterSpacing: 0.8,
  },
  uplinkDescription: {
    fontFamily: typography.body.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accentGreenSoft,
    backgroundColor: colors.encryptedBadgeBackground,
    marginBottom: 20,
  },
  primaryButtonText: {
    fontFamily: typography.headline.semiBold,
    fontSize: 17,
    color: colors.accentGreen,
    letterSpacing: 0.8,
  },
  footerNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 4,
  },
  footerText: {
    flex: 1,
    fontFamily: typography.body.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
});
