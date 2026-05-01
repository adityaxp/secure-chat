import { sha256 } from "js-sha256";
import "react-native-get-random-values";

/**
 * Pure JS SHA-256 hex (same as Node `createHash("sha256").update(data, "utf8").digest("hex")`).
 * Avoids native modules like `expo-crypto`, which require a rebuilt dev client.
 */
export function createHashSha256Hex(data: string): string {
  return sha256(data);
}

export function randomEntropyHex(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function createUserShareHash(input: {
  userId: string;
  userType: string;
  uplinkType: string;
  entropyHex: string;
}): string {
  const canonical = `${input.userId}|${input.userType}|${input.uplinkType}|${input.entropyHex}`;
  return createHashSha256Hex(canonical);
}

export function formatHashForDisplay(fullHex: string): string {
  if (!fullHex || fullHex.length < 14) return fullHex || "—";
  return `0x${fullHex.slice(0, 6)}...${fullHex.slice(-4)}`;
}
