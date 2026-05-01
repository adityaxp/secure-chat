import * as Crypto from "expo-crypto";

/**
 * React Native does not ship Node's `crypto` module. This matches:
 * `createHash("sha256").update(data, "utf8").digest("hex")`.
 */
export async function createHashSha256Hex(data: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}

export async function randomEntropyHex(byteLength = 16): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(byteLength);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createUserShareHash(input: {
  userId: string;
  userType: string;
  uplinkType: string;
  entropyHex: string;
}): Promise<string> {
  const canonical = `${input.userId}|${input.userType}|${input.uplinkType}|${input.entropyHex}`;
  return createHashSha256Hex(canonical);
}

export function formatHashForDisplay(fullHex: string): string {
  if (!fullHex || fullHex.length < 14) return fullHex || "—";
  return `0x${fullHex.slice(0, 6)}...${fullHex.slice(-4)}`;
}
