/** JSON envelope for binary payloads over the WebRTC string channel. */

export const WIRE_VERSION = 1 as const;

export type WireAttachmentV1 = {
  v: typeof WIRE_VERSION;
  kind: "image" | "file";
  mime: string;
  name: string;
  base64: string;
};

/** Max decoded binary size per attachment (bytes). */
export const MAX_ATTACHMENT_BYTES = 1_800_000;

export function buildAttachmentWire(payload: Omit<WireAttachmentV1, "v">): string {
  const envelope: WireAttachmentV1 = {
    v: WIRE_VERSION,
    kind: payload.kind,
    mime: payload.mime,
    name: payload.name,
    base64: payload.base64,
  };
  return JSON.stringify(envelope);
}

export type ParsedWire =
  | { type: "text"; text: string }
  | { type: "attachment"; attachment: WireAttachmentV1 };

export function parseDataChannelPayload(raw: string): ParsedWire {
  const t = raw.trim();
  if (!t.startsWith("{")) {
    return { type: "text", text: raw };
  }
  try {
    const o = JSON.parse(t) as Partial<WireAttachmentV1>;
    if (
      o.v === WIRE_VERSION &&
      (o.kind === "image" || o.kind === "file") &&
      typeof o.base64 === "string" &&
      typeof o.mime === "string" &&
      typeof o.name === "string"
    ) {
      return {
        type: "attachment",
        attachment: o as WireAttachmentV1,
      };
    }
  } catch {
    // fall through
  }
  return { type: "text", text: raw };
}

export function estimateBytesFromBase64(b64: string): number {
  const len = b64.length;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, (len * 3) / 4 - padding);
}
