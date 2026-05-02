import { FontAwesome6, Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
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

import PatternBackground from "@/components/PatternBackground";
import {
  sendChatMessage,
  startChatSession,
  stopChatSession,
} from "@/services/chatSession";
import type { ChatConnectionStatus } from "@/store/ChatSessionStore";
import { useChatSessionStore } from "@/store/ChatSessionStore";
import type { User } from "@/store/UserStore";
import { useUserStore } from "@/store/UserStore";
import { colors, typography } from "@/theme";

const COMMAND_SUGGESTIONS = [
  {
    key: "/image",
    icon: "image-outline" as const,
    label: "ENCRYPTED MEDIA",
  },
  {
    key: "/file",
    icon: "document-attach-outline" as const,
    label: "ATTACH DATA",
  },
  {
    key: "/link",
    icon: "link-outline" as const,
    label: "SHARE LINK",
  },
] as const;

function statusBannerLabel(status: ChatConnectionStatus): string {
  const map: Record<ChatConnectionStatus, string> = {
    idle: "IDLE",
    signaling: "CONNECTING TO SIGNALING…",
    waiting: "WAITING FOR PEER (SHARE YOUR USER HASH)",
    lookup: "LOOKING UP PEER BY HASH…",
    negotiating: "WEBRTC HANDSHAKE…",
    connected: "ENCRYPTED CHANNEL ESTABLISHED :: [256-BIT AES]",
    error: "SESSION ERROR",
  };
  return map[status] ?? status;
}

function headerStatusLabel(status: ChatConnectionStatus): string {
  const map: Record<ChatConnectionStatus, string> = {
    idle: "OFFLINE",
    signaling: "LINK",
    waiting: "WAIT",
    lookup: "FIND",
    negotiating: "PAIR",
    connected: "LIVE",
    error: "FAIL",
  };
  return map[status] ?? status;
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { user } = useUserStore();
  const messages = useChatSessionStore((s) => s.messages);
  const connectionStatus = useChatSessionStore((s) => s.connectionStatus);
  const errorMessage = useChatSessionStore((s) => s.errorMessage);
  const remotePeerId = useChatSessionStore((s) => s.remotePeerId);

  const scrollRef = React.useRef<ScrollView>(null);
  const [messageInput, setMessageInput] = React.useState("");
  const cursorOpacity = useSharedValue(1);
  const commandTokenMatch = messageInput.match(/(?:^|\s)(\/[^\s]*)$/);
  const commandQuery = commandTokenMatch?.[1] ?? "";
  const showCommandSuggestions = commandQuery.length > 0;
  const filteredSuggestions = COMMAND_SUGGESTIONS.filter((item) =>
    item.key.startsWith(commandQuery.toLowerCase()),
  );

  React.useEffect(() => {
    cursorOpacity.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 500 }),
        withTiming(1, { duration: 500 }),
      ),
      -1,
      false,
    );
  }, [cursorOpacity]);

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  React.useEffect(() => {
    if (!user?.userId || !user.userHash) {
      router.replace("/onboarding");
      return;
    }

    const rawHash = params.peerHash;
    const peerHash =
      typeof rawHash === "string"
        ? rawHash
        : Array.isArray(rawHash)
          ? rawHash[0]
          : undefined;
    const rawRole = params.role;
    const isHost =
      rawRole === "host" ||
      (Array.isArray(rawRole) && rawRole[0] === "host");

    if (!peerHash && !isHost) {
      router.replace("/user");
      return;
    }

    startChatSession({
      user: user as User,
      role: peerHash ? "join" : "host",
      peerHash,
    });

    return () => {
      stopChatSession();
    };
  }, [user?.userId, user?.userHash, params.peerHash, params.role]);

  React.useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  const sendFromInput = React.useCallback(() => {
    sendChatMessage(messageInput);
    setMessageInput("");
  }, [messageInput]);

  return (
    <PatternBackground patternSize={10}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <View style={styles.rootContent}>
          <View
            style={[
              styles.header,
              { paddingTop: insets.top + 8, paddingBottom: 12 },
            ]}
          >
            <View style={styles.headerLeft}>
              <View style={styles.idBadge}>
                <View style={styles.consoleIconBox}>
                  <View style={styles.consoleGlyphRow}>
                    <Text style={styles.consoleGlyph}>{">"}</Text>
                    <Animated.Text
                      style={[
                        styles.consoleGlyph,
                        styles.consoleCursor,
                        cursorStyle,
                      ]}
                    >
                      _
                    </Animated.Text>
                  </View>
                </View>
                <Text style={styles.idText} numberOfLines={1}>
                  {user?.userId ?? "NODE"}
                </Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <View style={styles.connectedBadge}>
                <View
                  style={[
                    styles.connectedDot,
                    connectionStatus === "connected" && styles.dotLive,
                    connectionStatus === "error" && styles.dotError,
                  ]}
                />
                <Text style={styles.connectedText}>
                  {headerStatusLabel(connectionStatus)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.syncButton}
                activeOpacity={0.8}
                onPress={() => {
                  router.push("/user");
                }}
              >
                <FontAwesome6
                  name="earth-americas"
                  size={17}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.encryptedBanner}>
            <Text style={styles.encryptedText}>
              {errorMessage
                ? errorMessage
                : remotePeerId && connectionStatus !== "connected"
                  ? `PEER :: ${remotePeerId}\n${statusBannerLabel(connectionStatus)}`
                  : statusBannerLabel(connectionStatus)}
            </Text>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.logScroll}
            contentContainerStyle={styles.logContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((item) => (
              <View key={item.id} style={styles.messageBlock}>
                <View style={styles.messageMetaRow}>
                  <Text style={styles.timeText}>[{item.at}]</Text>
                  <Text
                    style={[
                      styles.senderText,
                      item.senderLabel === "SYSTEM" && styles.senderSystem,
                    ]}
                  >
                    {item.senderLabel}
                  </Text>
                  {item.outgoing ? (
                    <Text style={styles.metaText}>OUT</Text>
                  ) : item.senderLabel !== "SYSTEM" ? (
                    <Text style={styles.metaText}>IN</Text>
                  ) : null}
                </View>
                <Text style={styles.messageBody}>{item.body}</Text>
              </View>
            ))}
          </ScrollView>

          {showCommandSuggestions ? (
            <View
              style={[
                styles.commandSuggestionsCard,
                { bottom: insets.bottom + 68 },
              ]}
            >
              <Text style={styles.commandSuggestionsTitle}>
                COMMAND SUGGESTIONS
              </Text>
              {(filteredSuggestions.length
                ? filteredSuggestions
                : COMMAND_SUGGESTIONS
              ).map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={styles.commandSuggestionRow}
                  activeOpacity={0.85}
                  onPress={() =>
                    setMessageInput(
                      messageInput.replace(
                        /(^|\s)\/[^\s]*$/,
                        (_full, leadingSpace: string) =>
                          `${leadingSpace}${item.key} `,
                      ),
                    )
                  }
                >
                  <Ionicons
                    name={item.icon}
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.commandSuggestionKey}>{item.key}</Text>
                  <Text style={styles.commandSuggestionLabel}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <View
            style={[styles.inputBar, { marginBottom: insets.bottom + 8 }]}
          >
            <Text style={styles.promptMark}>{">"}</Text>
            <TextInput
              value={messageInput}
              onChangeText={setMessageInput}
              style={styles.inputPlaceholder}
              placeholder="ENTER COMMAND OR MESSAGE ..."
              placeholderTextColor="#666C68"
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={sendFromInput}
              returnKeyType="send"
            />
            <Ionicons
              name="code-slash-outline"
              size={16}
              color={colors.textSecondary}
            />
            <TouchableOpacity
              onPress={sendFromInput}
              hitSlop={10}
              activeOpacity={0.8}
            >
              <Ionicons
                name="send-outline"
                size={17}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </PatternBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  rootContent: {
    flex: 1,
    zIndex: 1,
  },
  header: {
    minHeight: 50,
    borderBottomWidth: 1,
    borderColor: colors.chatBorder,
    backgroundColor: colors.avatarBackground,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  idBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  consoleIconBox: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  consoleGlyphRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  consoleGlyph: {
    fontFamily: typography.body.medium,
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  consoleCursor: {
    letterSpacing: 0,
  },
  idText: {
    fontFamily: typography.headline.bold,
    color: colors.textPrimary,
    fontSize: 16,
    letterSpacing: 0.9,
  },
  connectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.chatBorder,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: "rgba(17, 20, 23, 0.78)",
    borderRadius: 4,
  },
  connectedDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.textMuted,
  },
  dotLive: {
    backgroundColor: colors.online,
  },
  dotError: {
    backgroundColor: colors.danger,
  },
  connectedText: {
    fontFamily: typography.headline.medium,
    color: colors.textSecondary,
    fontSize: 10,
    letterSpacing: 0.9,
  },
  syncButton: {
    width: 26,
    height: 26,
    borderWidth: 0,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  encryptedBanner: {
    borderWidth: 1,
    borderColor: colors.chatBorder,
    backgroundColor: "rgba(16,16,16,0.7)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 12,
    marginHorizontal: 14,
  },
  encryptedText: {
    fontFamily: typography.headline.medium,
    color: colors.textPrimary,
    fontSize: 14,
    letterSpacing: 2,
    textTransform: "uppercase",
    lineHeight: 20,
  },
  logScroll: {
    flex: 1,
    marginTop: 12,
    paddingHorizontal: 16,
  },
  logContent: {
    paddingLeft: 8,
    paddingBottom: 12,
    borderLeftWidth: 1,
    borderLeftColor: colors.chatBorder,
  },
  messageBlock: {
    marginBottom: 18,
  },
  messageMetaRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  timeText: {
    fontFamily: typography.body.medium,
    color: colors.textMuted,
    fontSize: 14,
  },
  senderText: {
    fontFamily: typography.headline.bold,
    color: colors.textPrimary,
    fontSize: 16,
    letterSpacing: 0.2,
  },
  senderSystem: {
    color: colors.accentGreenSoft,
    fontSize: 12,
  },
  metaText: {
    fontFamily: typography.headline.medium,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  messageBody: {
    fontFamily: typography.body.regular,
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 17,
    marginTop: 5,
    paddingRight: 8,
  },
  fileCard: {
    borderWidth: 1,
    borderColor: colors.chatBorder,
    borderRadius: 10,
    backgroundColor: "rgba(16,16,16,0.7)",
    minHeight: 58,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontFamily: typography.headline.medium,
    color: colors.textPrimary,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  fileMeta: {
    fontFamily: typography.body.medium,
    color: colors.textMuted,
    fontSize: 9,
    marginTop: 1,
  },
  inputBar: {
    minHeight: 60,
    borderWidth: 1,
    borderColor: colors.chatBorder,
    backgroundColor: "rgba(16, 16, 16, 0.43)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  promptMark: {
    fontFamily: typography.headline.bold,
    color: colors.textSecondary,
    fontSize: 16,
  },
  inputPlaceholder: {
    flex: 1,
    fontFamily: typography.headline.medium,
    color: "#666C68",
    fontSize: 12,
    letterSpacing: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  commandSuggestionsCard: {
    position: "absolute",
    left: 10,
    right: 50,
    borderWidth: 1,
    borderColor: colors.chatBorder,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(14, 18, 20, 0.78)",
    marginBottom: 5,
    zIndex: 20,
  },
  commandSuggestionsTitle: {
    fontFamily: typography.headline.medium,
    color: colors.textSecondary,
    fontSize: 10,
    letterSpacing: 0.9,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.chatBorder,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  commandSuggestionRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(83, 100, 87, 0.10)",
    backgroundColor: "rgba(255, 255, 255, 0.001)",
  },
  commandSuggestionKey: {
    fontFamily: typography.headline.bold,
    color: colors.textPrimary,
    fontSize: 13,
    letterSpacing: 0.4,
    minWidth: 64,
  },
  commandSuggestionLabel: {
    marginLeft: "auto",
    fontFamily: typography.headline.medium,
    color: "#B8C5B4",
    fontSize: 9,
    letterSpacing: 0.6,
  },
});
