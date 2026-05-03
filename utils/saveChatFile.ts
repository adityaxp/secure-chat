import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export function safeAttachmentFileName(name: string): string {
  const base = name.trim().split(/[/\\]/).pop() || "download";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return (cleaned.length > 0 ? cleaned : "download").slice(0, 120);
}

/**
 * Writes base64 to cache and opens the share sheet (Save to Files / Drive, etc.).
 */
export async function saveBase64ToCacheAndShare(opts: {
  base64: string;
  displayName: string;
  mime?: string;
}): Promise<void> {
  const dir = FileSystem.cacheDirectory;
  if (!dir) {
    throw new Error("Cache directory unavailable.");
  }

  const fileName = `${safeAttachmentFileName(opts.displayName)}_${Date.now()}`;
  const path = `${dir}${fileName}`;

  await FileSystem.writeAsStringAsync(path, opts.base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: opts.mime ?? "application/octet-stream",
      dialogTitle: opts.displayName,
    });
    return;
  }

  throw new Error("Sharing is not available on this device.");
}
