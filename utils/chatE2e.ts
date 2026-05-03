import "react-native-get-random-values";

import { gcm } from "@noble/ciphers/aes.js";
import { randomBytes } from "@noble/ciphers/utils.js";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { Buffer } from "buffer";

const PBKDF2_ITERATIONS = 80_000;
const AES_KEY_LEN = 32;
const NONCE_LEN = 12;
const enc = new TextEncoder();

/** Prefix for AES-GCM payloads on the data channel (plain JSON/text has no prefix). */
export const E2E_PREFIX = "ENC1:";

/**
 * Session-bound salt: both peers derive the same bytes from sorted node IDs
 * (no network exchange; binds PBKDF2 to this pair).
 */
export function pairSessionSalt(localPeerId: string, remotePeerId: string): Uint8Array {
  const [a, b] = [localPeerId, remotePeerId].sort();
  return sha256(enc.encode(`secure-chat-e2e-pair-v1|${a}|${b}`));
}

export function deriveAesKeyFromPassphrase(
  passphrase: string,
  pairSalt: Uint8Array,
): Uint8Array {
  return pbkdf2(sha256, passphrase.trim(), pairSalt, {
    c: PBKDF2_ITERATIONS,
    dkLen: AES_KEY_LEN,
  });
}

/** 10-byte fingerprint as `AA:BB:…` for out-of-band comparison (same passphrase + pair → same code). */
export function formatSessionFingerprint(
  key32: Uint8Array,
  localPeerId: string,
  remotePeerId: string,
): string {
  const [a, b] = [localPeerId, remotePeerId].sort();
  const tail = enc.encode(`${a}|${b}|fp-v1`);
  const buf = new Uint8Array(key32.length + tail.length);
  buf.set(key32, 0);
  buf.set(tail, key32.length);
  const tag = sha256(buf).subarray(0, 10);
  return [...tag]
    .map((x) => x.toString(16).padStart(2, "0").toUpperCase())
    .join(":");
}

function concatNonceCipher(nonce: Uint8Array, cipherBytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(nonce.length + cipherBytes.length);
  out.set(nonce, 0);
  out.set(cipherBytes, nonce.length);
  return out;
}

/**
 * AES-256-GCM encrypt UTF-8 string → `ENC1:` + base64(nonce‖ciphertext‖tag).
 */
export function encryptTransport(plaintext: string, key32: Uint8Array): string {
  if (key32.length !== AES_KEY_LEN) {
    throw new Error("AES-256 key must be 32 bytes.");
  }
  const data = new TextEncoder().encode(plaintext);
  const nonce = randomBytes(NONCE_LEN);
  const cipher = gcm(key32, nonce);
  const sealed = cipher.encrypt(data);
  const packed = concatNonceCipher(nonce, sealed);
  return E2E_PREFIX + Buffer.from(packed).toString("base64");
}

/**
 * Reverse {@link encryptTransport}. Returns `null` on failure (wrong key / corrupt).
 */
export function decryptTransport(payload: string, key32: Uint8Array): string | null {
  const p = payload.trimStart();
  if (!p.startsWith(E2E_PREFIX)) return null;
  if (key32.length !== AES_KEY_LEN) return null;
  try {
    const packed = new Uint8Array(
      Buffer.from(p.slice(E2E_PREFIX.length), "base64"),
    );
    if (packed.length < NONCE_LEN + 16) return null;
    const nonce = packed.slice(0, NONCE_LEN);
    const sealed = packed.slice(NONCE_LEN);
    const cipher = gcm(key32, nonce);
    const plain = cipher.decrypt(sealed);
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

export function looksLikeE2ePayload(s: string): boolean {
  return s.trimStart().startsWith(E2E_PREFIX);
}
