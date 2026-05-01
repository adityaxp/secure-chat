export function getSignalingWsUrl(): string | undefined {
  const raw =
    process.env.EXPO_PUBLIC_SIGNALING_URL ??
    process.env.EXPO_PUBLIC_SIGNALING_WS_URL;
  const trimmed = raw?.trim();
  return trimmed || undefined;
}
