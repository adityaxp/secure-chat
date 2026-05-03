import { FontAwesome6, Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  Keyboard,
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
  sendChatAttachment,
  sendChatMessage,
  startChatSession,
  stopChatSession,
} from "@/services/chatSession";
import type {
  ChatConnectionStatus,
  ChatLine,
} from "@/store/ChatSessionStore";
import { useChatSessionStore } from "@/store/ChatSessionStore";
import { useLastChatRouteStore } from "@/store/LastChatRouteStore";
import type { User } from "@/store/UserStore";
import { useUserStore } from "@/store/UserStore";
import { colors, typography } from "@/theme";
import { saveBase64ToCacheAndShare } from "@/utils/saveChatFile";

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
    key: "/disconnect",
    icon: "exit-outline" as const,
    label: "DISCONNECT",
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
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);
  const cursorOpacity = useSharedValue(1);
  const commandTokenMatch = messageInput.match(/(?:^|\s)(\/[^\s]*)$/);
  const commandQuery = commandTokenMatch?.[1] ?? "";
  const showCommandSuggestions = commandQuery.length > 0;
  const [showCommands, setShowCommands] = React.useState(false);
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
      rawRole === "host" || (Array.isArray(rawRole) && rawRole[0] === "host");

    if (!peerHash && !isHost) {
      router.replace("/user");
      return;
    }

    useLastChatRouteStore
      .getState()
      .setLastChatRoute(
        peerHash ? { role: "join", peerHash } : { role: "host" },
      );

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

  React.useEffect(() => {
    const showEvt =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const subShow = Keyboard.addListener(showEvt, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const subHide = Keyboard.addListener(hideEvt, () => {
      setKeyboardHeight(0);
    });

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  React.useEffect(() => {
    if (keyboardHeight <= 0) return;
    const id = requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(id);
  }, [keyboardHeight]);

  const appendSystem = React.useCallback((body: string) => {
    useChatSessionStore.getState().appendMessage({
      senderLabel: "SYSTEM",
      body,
      outgoing: false,
    });
  }, []);

  const downloadChatFile = React.useCallback(
    async (item: ChatLine) => {
      if (!item.attachmentBase64) return;
      try {
        await saveBase64ToCacheAndShare({
          base64: item.attachmentBase64,
          displayName: item.attachmentName ?? item.body ?? "file",
          mime: item.mime,
        });
      } catch {
        appendSystem("Could not save or share the file.");
      }
    },
    [appendSystem],
  );

  const pickAndSendImage = React.useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        appendSystem("Allow photo library access to attach images.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.82,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;

      let b64 = asset.base64 ?? null;
      if (!b64 && asset.uri) {
        b64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: "base64",
        });
      }
      if (!b64) {
        appendSystem("Could not read the selected image.");
        return;
      }

      const mime = asset.mimeType ?? "image/jpeg";
      const ext = mime.includes("png")
        ? "png"
        : mime.includes("webp")
          ? "webp"
          : mime.includes("gif")
            ? "gif"
            : "jpg";
      const name =
        asset.fileName ?? `image_${Date.now()}.${ext}`;

      sendChatAttachment({
        kind: "image",
        mime,
        name,
        base64: b64,
        localUri: asset.uri,
      });
    } catch {
      appendSystem("Image picker failed.");
    }
  }, [appendSystem]);

  const pickAndSendFile = React.useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const b64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: "base64",
      });
      sendChatAttachment({
        kind: "file",
        mime: asset.mimeType ?? "application/octet-stream",
        name: asset.name || "file",
        base64: b64,
      });
    } catch {
      appendSystem("File picker failed.");
    }
  }, [appendSystem]);

  const sendFromInput = React.useCallback(() => {
    const trimmed = messageInput.trim();
    if (!trimmed) return;

    const lower = trimmed.toLowerCase();
    if (lower === "/image") {
      setMessageInput("");
      void pickAndSendImage();
      return;
    }
    if (lower === "/file") {
      setMessageInput("");
      void pickAndSendFile();
      return;
    }

    if (trimmed.toLowerCase() === "/disconnect") {
      sendChatMessage(trimmed);
      setMessageInput("");
      setTimeout(() => {
        stopChatSession();
        useLastChatRouteStore.getState().setLastChatRoute(null);
        router.replace("/splash");
      }, 160);
      Keyboard.dismiss();

      return;
    }

    sendChatMessage(messageInput);
    setMessageInput("");
    Keyboard.dismiss();
  }, [messageInput, pickAndSendFile, pickAndSendImage]);

  const keyboardGap = 20;
  const composerBottomGap =
    keyboardHeight > 0 ? keyboardHeight + keyboardGap : insets.bottom + 8;
  const suggestionsBottom =
    (keyboardHeight > 0 ? keyboardHeight + keyboardGap : insets.bottom) + 72;

  return (
    <PatternBackground patternSize={10}>
      <View style={styles.root}>
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

          <View style={styles.logSection}>
            <ScrollView
              ref={scrollRef}
              style={styles.logScroll}
              contentContainerStyle={styles.logContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {messages.map((item) => {
                const showImage =
                  item.messageKind === "image" && Boolean(item.mediaUri);
                const showFile = item.messageKind === "file";
                return (
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
                    {showImage && item.mediaUri ? (
                      <Image
                        source={{ uri: item.mediaUri }}
                        style={styles.chatImage}
                        contentFit="cover"
                        accessibilityLabel={item.attachmentName ?? "Image"}
                      />
                    ) : showFile ? (
                      <View style={styles.fileCard}>
                        <Ionicons
                          name="document-attach-outline"
                          size={22}
                          color={colors.textSecondary}
                        />
                        <View style={styles.fileInfo}>
                          <Text style={styles.fileName} numberOfLines={2}>
                            {item.attachmentName ?? item.body}
                          </Text>
                          {item.mime ? (
                            <Text style={styles.fileMeta} numberOfLines={1}>
                              {item.mime}
                            </Text>
                          ) : null}
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.fileDownloadBtn,
                            !item.attachmentBase64 &&
                              styles.fileDownloadBtnDisabled,
                          ]}
                          disabled={!item.attachmentBase64}
                          accessibilityLabel="Download or share file"
                          hitSlop={8}
                          activeOpacity={0.75}
                          onPress={() => void downloadChatFile(item)}
                        >
                          <Ionicons
                            name="download-outline"
                            size={22}
                            color={
                              item.attachmentBase64
                                ? colors.accentGreen
                                : colors.textMuted
                            }
                          />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={styles.messageBody}>{item.body}</Text>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>

          {showCommandSuggestions || showCommands ? (
            <View
              style={[
                styles.commandSuggestionsCard,
                { bottom: suggestionsBottom },
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
                  onPress={() => {
                    if (item.key === "/image") {
                      setShowCommands(false);
                      void pickAndSendImage();
                      return;
                    }
                    if (item.key === "/file") {
                      setShowCommands(false);
                      void pickAndSendFile();
                      return;
                    }
                    setMessageInput(
                      messageInput.replace(
                        /(^|\s)\/[^\s]*$/,
                        (_full, leadingSpace: string) =>
                          `${leadingSpace}${item.key} `,
                      ),
                    );
                  }}
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
            style={[styles.composerWrap, { marginBottom: composerBottomGap }]}
          >
            <View style={styles.inputBar}>
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
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setShowCommands(!showCommands);
                }}
              >
                <Ionicons
                  name="code-slash-outline"
                  size={16}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
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
        </View>
      </View>
    </PatternBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  rootContent: {
    flex: 1,
    minHeight: 0,
    zIndex: 1,
  },
  composerWrap: {
    flexShrink: 0,
  },
  logSection: {
    flex: 1,
    minHeight: 0,
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
    minHeight: 0,
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
  chatImage: {
    marginTop: 8,
    height: 180,
    width: "100%",
    maxWidth: 280,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.chatBorder,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  fileCard: {
    marginTop: 8,
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
  fileDownloadBtn: {
    padding: 8,
    marginLeft: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.chatBorder,
    backgroundColor: "rgba(17, 43, 26, 0.45)",
  },
  fileDownloadBtnDisabled: {
    opacity: 0.4,
  },
  fileInfo: {
    flex: 1,
    minWidth: 0,
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
