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
  // TEMP (testing): random "000"–"999". Revert: remove this block and use:
  //   const canonical = `${input.userId}|${input.userType}|${input.uplinkType}|${input.entropyHex}`;
  //   return createHashSha256Hex(canonical);
  void input;
  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  const n = ((bytes[0] << 8) | bytes[1]) % 1000;
  return String(n).padStart(3, "0");
}

/**
 * Same rules as signaling `normalizeHash` for `targetHash` / `profile.userHash`.
 * Pads 1–3 digit numeric codes to 3 digits so "42" matches "042" (testing).
 */
export function normalizePeerHashForLookup(raw: string): string {
  let s = raw
    .replace(/^0x/i, "")
    .replace(/\s/g, "")
    .toLowerCase();
  if (/^\d+$/.test(s) && s.length >= 1 && s.length <= 3) {
    s = s.padStart(3, "0");
  }
  return s;
}

export function formatHashForDisplay(fullHex: string): string {
  if (!fullHex || fullHex.length < 14) return fullHex || "—";
  return `0x${fullHex.slice(0, 6)}...${fullHex.slice(-4)}`;
}
