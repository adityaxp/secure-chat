import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useRef } from "react";
import {
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { userImageXX, userImageXY } from "@/assets/images";
import BottomSheetModal from "@/components/BottomSheetModal";
import JoinSessionSheetPanel from "@/components/JoinSessionSheetPanel";
import PatternBackground from "@/components/PatternBackground";
import SessionSheetPanel from "@/components/SessionSheetPanel";
import { useLastChatRouteStore } from "@/store/LastChatRouteStore";
import { useUserStore } from "@/store/UserStore";
import { colors, typography } from "@/theme";
import { formatHashForDisplay } from "@/utils/hash";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function UserScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUserStore();
  const lastChatRoute = useLastChatRouteStore((s) => s.lastChatRoute);
  const sessionSheetRef = useRef<TrueSheet | null>(null);
  const joinSessionSheetRef = useRef<TrueSheet | null>(null);

  const roomCodeLabel = React.useMemo(() => {
    if (lastChatRoute?.role === "join" && lastChatRoute.peerHash) {
      return lastChatRoute.peerHash;
    }
    return user?.userId ?? "—";
  }, [lastChatRoute, user?.userId]);

  const openLastOrHostChat = React.useCallback(() => {
    const r = useLastChatRouteStore.getState().lastChatRoute;
    if (r?.role === "join" && r.peerHash) {
      router.push({ pathname: "/chat", params: { peerHash: r.peerHash } });
      return;
    }
    router.push({ pathname: "/chat", params: { role: "host" } });
  }, []);

  const openSessionSheet = React.useCallback(() => {
    void sessionSheetRef.current?.present();
  }, []);

  const goToChatFromSheet = React.useCallback(() => {
    void sessionSheetRef.current?.dismiss();
    router.push({ pathname: "/chat", params: { role: "host" } });
  }, []);

  const openJoinSessionSheet = React.useCallback(async () => {
    await sessionSheetRef.current?.dismiss();
    await joinSessionSheetRef.current?.present();
  }, []);

  const joinWithPeerHash = React.useCallback((peerHash: string) => {
    if (!peerHash) return;
    void joinSessionSheetRef.current?.dismiss();
    router.push({ pathname: "/chat", params: { peerHash } });
  }, []);

  const settingRows = [
    {
      label: "CREATE_JOIN_SESSION",
      value: "Start new or connect a session",
      icon: "account-multiple-plus-outline",
      iconLib: "mc",
      type: "chevron",
      onPress: openSessionSheet,
    },
    {
      label: "ENCRYPTION_KEYS",
      value: "Manage RSA/Ed25519 pairs",
      icon: "key-variant",
      iconLib: "mc",
      type: "chevron",
      onPress: () => {},
    },
    {
      label: "PREVIOUS_SESSIONS",
      value: "Review recent sessions",
      icon: "history",
      iconLib: "mc",
      type: "chevron",
      onPress: () => {},
    },

    {
      label: "UI_THEME",
      value: "Current: Terminal P2P (Green Phosphor)",
      icon: "palette-outline",
      iconLib: "mc",
      type: "chevron",
      onPress: () => {},
    },
  ] as const;

  return (
    <PatternBackground patternSize={10}>
      <LinearGradient
        colors={[colors.panelGradientStart, colors.panelGradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerRow, { paddingTop: insets.top }]}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.idText}>ID: {user?.userId}</Text>
        </View>
        <View style={styles.encryptedBadge}>
          <Text style={styles.encryptedText}>ENCRYPTED</Text>
        </View>
      </LinearGradient>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarSection}>
          <View style={styles.avatarFrame}>
            <Image
              source={user?.userType === "XX" ? userImageXX : userImageXY}
              style={styles.avatar}
              contentFit="contain"
            />
          </View>
          <View style={styles.verifiedBadge}>
            <Ionicons
              name="lock-closed"
              size={14}
              color={colors.verifiedLockIcon}
            />
          </View>
          <Text style={styles.userName}>{user?.userId}</Text>
          <View style={styles.userHashRow}>
            <Text style={styles.userHash}>
              {formatHashForDisplay(user?.userHash ?? "")}
            </Text>
            <TouchableOpacity
              onPress={() => {
                const h = user?.userHash;
                if (h) void Share.share({ message: h });
              }}
            >
              <Ionicons
                name="arrow-redo-outline"
                size={24}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.userInfoContainer}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={openLastOrHostChat}
            accessibilityRole="button"
            accessibilityLabel="Open P2P chat session"
          >
            <LinearGradient
              colors={[colors.panelGradientStart, colors.panelGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.nodeCard}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <MaterialCommunityIcons
                  name="source-branch"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text
                  style={styles.nodeText}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  NODE: {roomCodeLabel}
                </Text>
              </View>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <View style={styles.statusDot} />
                <Text style={styles.activeText}>ACTIVE</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.sectionLabel}>SECURITY & INFRASTRUCTURE</Text>
          <LinearGradient
            colors={[colors.panelGradientStart, colors.panelGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.settingsGroup}
          >
            {settingRows.map((item, index, arr) => (
              <TouchableOpacity
                key={item.label}
                style={[
                  styles.settingRow,
                  index === arr.length - 1 && styles.lastRow,
                ]}
                onPress={item.onPress}
              >
                <View style={styles.settingIconWrap}>
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={18}
                    color={colors.textSecondary}
                  />
                </View>
                <View style={styles.settingBody}>
                  <Text style={styles.settingLabel}>{item.label}</Text>
                  <Text style={styles.settingValue}>{item.value}</Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            ))}
          </LinearGradient>

          <TouchableOpacity
            style={styles.disconnectButton}
            onPress={() => {
              router.replace("/splash");
            }}
          >
            <MaterialCommunityIcons
              name="power"
              size={19}
              color={colors.danger}
            />
            <Text style={styles.disconnectText}>DISCONNECT</Text>
          </TouchableOpacity>

          <Text style={styles.warningText}>
            Warning: Connection termination will purge session memory
          </Text>
        </View>
      </ScrollView>
      <BottomSheetModal bottomSheetRef={sessionSheetRef} detents={[0.48, 0.78]}>
        <SessionSheetPanel
          onCreateSession={goToChatFromSheet}
          onJoinSession={openJoinSessionSheet}
        />
      </BottomSheetModal>
      <BottomSheetModal
        bottomSheetRef={joinSessionSheetRef}
        detents={[0.35, 0.55]}
      >
        <JoinSessionSheetPanel onJoin={joinWithPeerHash} />
      </BottomSheetModal>
    </PatternBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    zIndex: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    paddingVertical: 12,
    backgroundColor: colors.panel,
    borderBottomColor: colors.panelBorder,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  idText: {
    fontFamily: typography.headline.medium,
    fontSize: 18,
    color: colors.textPrimary,
    letterSpacing: 0.8,
  },
  encryptedBadge: {
    borderWidth: 1,
    borderColor: colors.accentGreenSoft,
    backgroundColor: colors.encryptedBadgeBackground,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  encryptedText: {
    fontFamily: typography.headline.medium,
    fontSize: 10,
    color: colors.accentGreen,
    letterSpacing: 0.9,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 10,
  },
  avatarFrame: {
    width: 150,
    height: 150,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.avatarFrameBorder,
    overflow: "hidden",
    backgroundColor: colors.avatarBackground,
    padding: 10,
    marginVertical: 10,
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  verifiedBadge: {
    marginTop: -30,
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.accentGreenSoft,
    backgroundColor: colors.verifiedBadgeBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    marginTop: 6,
    fontFamily: typography.headline.bold,
    fontSize: 24,
    lineHeight: 54,
    color: colors.textPrimary,
  },
  userHash: {
    marginTop: 2,
    fontFamily: typography.body.medium,
    fontSize: 35,
    color: colors.textSecondary,
  },
  userHashRow: {
    marginTop: 2,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  nodeCard: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    backgroundColor: colors.panel,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 8,
    gap: 6,
  },
  nodeText: {
    fontFamily: typography.headline.regular,
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 1.1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.online,
    marginLeft: 3,
  },
  activeText: {
    fontFamily: typography.headline.medium,
    fontSize: 12,
    color: colors.textPrimary,
    letterSpacing: 1.1,
  },
  sectionLabel: {
    fontFamily: typography.headline.medium,
    color: colors.textSecondary,
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  settingsGroup: {
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: 12,
    backgroundColor: colors.panel,
    marginBottom: 8,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.panelBorderSoft,
    gap: 8,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  settingIconWrap: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: 8,
    backgroundColor: colors.settingIconBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  settingBody: {
    flex: 1,
  },
  settingLabel: {
    fontFamily: typography.headline.medium,
    fontSize: 18,
    lineHeight: 22,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  settingValue: {
    marginTop: 0,
    fontFamily: typography.body.medium,
    fontSize: 17,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 3,
    backgroundColor: colors.accentBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  disconnectButton: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 10,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  disconnectText: {
    fontFamily: typography.headline.medium,
    fontSize: 18,
    color: colors.danger,
    letterSpacing: 1.2,
  },
  warningText: {
    textAlign: "center",
    fontFamily: typography.body.italic,
    fontSize: 15,
    lineHeight: 21,
    color: colors.accentAmber,
    paddingHorizontal: 14,
  },
  userInfoContainer: {
    paddingHorizontal: 12,
    gap: 12,
  },
});
