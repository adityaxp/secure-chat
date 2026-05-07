import { Buffer } from "buffer";
import { PermissionsAndroid, Platform } from "react-native";
import { BleManager, type Device, type Subscription } from "react-native-ble-plx";

import { useChatE2eStore } from "@/store/ChatE2eStore";
import {
  chatTimestamp,
  useChatSessionStore,
} from "@/store/ChatSessionStore";
import type { User } from "@/store/UserStore";
import { normalizePeerHashForLookup } from "@/utils/hash";
import {
  decryptTransport,
  encryptTransport,
  looksLikeE2ePayload,
} from "@/utils/chatE2e";
import {
  buildAttachmentWire,
  estimateBytesFromBase64,
  MAX_ATTACHMENT_BYTES,
  parseDataChannelPayload,
} from "@/utils/chatWire";
import { stopInternetNode } from "./internetNode";

const CHAT_SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
const CHAT_TX_CHAR_UUID = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E";
const CHAT_RX_CHAR_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";
const SCAN_TIMEOUT_MS = 20_000;
const LOOKUP_RESPONSE_TIMEOUT_MS = 15_000;
const BLE_PACKET_SIZE = 140;

type WireChunk = {
  t: "chunk";
  id: string;
  s: number;
  e: 0 | 1;
  d: string;
};

type PartialChunk = { parts: string[]; at: number };

export class BluetoothChatSession {
  private readonly manager = new BleManager();
  private connectedDevice: Device | null = null;
  private monitorSub: Subscription | null = null;
  private scanTimer: ReturnType<typeof setTimeout> | null = null;
  private lookupTimer: ReturnType<typeof setTimeout> | null = null;
  private incomingById = new Map<string, PartialChunk>();

  constructor(
    private readonly user: User,
    private readonly role: "host" | "join",
    private readonly targetPeerHash?: string,
  ) {}

  async start() {
    stopInternetNode();
    const store = useChatSessionStore.getState();
    store.reset();
    store.setConnectionStatus("signaling");

    const ok = await this.requestBlePermissions();
    if (!ok) {
      store.setError("Bluetooth permission denied.");
      store.setConnectionStatus("error");
      return;
    }

    const state = await this.manager.state();
    if (state !== "PoweredOn") {
      store.setError("Bluetooth is off. Please turn it on.");
      store.setConnectionStatus("error");
      return;
    }

    if (this.role === "join") {
      store.setConnectionStatus("lookup");
      this.scheduleLookupTimeout();
    } else {
      store.setConnectionStatus("waiting");
      store.appendMessage({
        senderLabel: "SYSTEM",
        body: "BLE scan started. Waiting for nearby peer device.",
        outgoing: false,
      });
    }

    this.startScan();
  }

  private async requestBlePermissions(): Promise<boolean> {
    if (Platform.OS !== "android") return true;
    const sdk = Number(Platform.Version);
    if (sdk < 31) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }

    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return (
      results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
        PermissionsAndroid.RESULTS.GRANTED &&
      results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
        PermissionsAndroid.RESULTS.GRANTED
    );
  }

  private startScan() {
    this.clearScanTimer();
    this.scanTimer = setTimeout(() => {
      this.scanTimer = null;
      this.manager.stopDeviceScan();
      const s = useChatSessionStore.getState();
      if (s.connectionStatus === "lookup" || s.connectionStatus === "waiting") {
        s.setError("No BLE peer found. Ensure both devices are discoverable.");
        s.setConnectionStatus("error");
      }
    }, SCAN_TIMEOUT_MS);

    this.manager.startDeviceScan(
      [CHAT_SERVICE_UUID],
      { allowDuplicates: false },
      (error, device) => {
        if (error || !device || this.connectedDevice) return;
        if (!this.matchesPeer(device)) return;
        this.manager.stopDeviceScan();
        this.clearScanTimer();
        void this.connectDevice(device);
      },
    );
  }

  private matchesPeer(device: Device): boolean {
    const target = normalizePeerHashForLookup(this.targetPeerHash ?? "");
    if (!target) return true;
    const name = (device.name ?? device.localName ?? "").toUpperCase();
    const id = device.id.toUpperCase();
    return name.includes(target) || id.includes(target);
  }

  private async connectDevice(device: Device) {
    try {
      useChatSessionStore.getState().setConnectionStatus("negotiating");
      const connected = await this.manager.connectToDevice(device.id, {
        autoConnect: false,
        timeout: 12_000,
      });
      await connected.discoverAllServicesAndCharacteristics();
      this.connectedDevice = connected;
      this.clearLookupTimeout();
      useChatSessionStore.getState().setRemotePeerId(
        connected.name ?? connected.localName ?? connected.id,
      );
      useChatSessionStore.getState().setConnectionStatus("connected");
      useChatSessionStore.getState().appendMessage({
        senderLabel: "SYSTEM",
        body: "BLE encrypted link established.",
        outgoing: false,
      });

      this.monitorSub = connected.monitorCharacteristicForService(
        CHAT_SERVICE_UUID,
        CHAT_RX_CHAR_UUID,
        (error, characteristic) => {
          if (error || !characteristic?.value) return;
          try {
            const raw = Buffer.from(characteristic.value, "base64").toString(
              "utf8",
            );
            this.handleBlePacket(raw);
          } catch {
            // ignore malformed packet
          }
        },
      );
    } catch {
      useChatSessionStore.getState().setError(
        "Could not connect to BLE peer device.",
      );
      useChatSessionStore.getState().setConnectionStatus("error");
    }
  }

  private handleBlePacket(rawPacket: string) {
    let packet: WireChunk;
    try {
      packet = JSON.parse(rawPacket) as WireChunk;
    } catch {
      return;
    }
    if (packet.t !== "chunk") return;

    const current = this.incomingById.get(packet.id) ?? { parts: [], at: Date.now() };
    current.parts[packet.s] = packet.d;
    current.at = Date.now();
    this.incomingById.set(packet.id, current);

    if (packet.e !== 1) return;

    const message = current.parts.join("");
    this.incomingById.delete(packet.id);
    this.appendIncomingChat(message);
  }

  private async sendRawPayload(payload: string) {
    const device = this.connectedDevice;
    if (!device) return;
    const id = `${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
    const chunks = payload.match(new RegExp(`.{1,${BLE_PACKET_SIZE}}`, "g")) ?? [];
    for (let i = 0; i < chunks.length; i += 1) {
      const packet: WireChunk = {
        t: "chunk",
        id,
        s: i,
        e: i === chunks.length - 1 ? 1 : 0,
        d: chunks[i],
      };
      const b64 = Buffer.from(JSON.stringify(packet), "utf8").toString("base64");
      await device.writeCharacteristicWithResponseForService(
        CHAT_SERVICE_UUID,
        CHAT_TX_CHAR_UUID,
        b64,
      );
    }
  }

  private unwrapChannelPayload(
    raw: string,
  ): { ok: true; data: string } | { ok: false; error: string } {
    const key = useChatE2eStore.getState().key;
    if (!key) {
      if (looksLikeE2ePayload(raw)) {
        return {
          ok: false,
          error:
            "Peer is using end-to-end encryption. Tap the lock and enter the same passphrase.",
        };
      }
      return { ok: true, data: raw };
    }

    if (!looksLikeE2ePayload(raw)) {
      return { ok: true, data: raw };
    }

    const dec = decryptTransport(raw.trim(), key);
    if (dec === null) {
      return {
        ok: false,
        error: "Could not decrypt. Your passphrase must match your peer's exactly.",
      };
    }
    return { ok: true, data: dec };
  }

  private wrapOutgoing(data: string): string {
    const key = useChatE2eStore.getState().key;
    if (!key) return data;
    try {
      return encryptTransport(data, key);
    } catch {
      useChatSessionStore.getState().appendMessage({
        senderLabel: "SYSTEM",
        body: "E2E encryption failed; message sent without E2E wrap.",
        outgoing: false,
      });
      return data;
    }
  }

  private appendIncomingChat(text: string) {
    const label = useChatSessionStore.getState().remotePeerId ?? "PEER";
    const unwrapped = this.unwrapChannelPayload(text);
    if (!unwrapped.ok) {
      useChatSessionStore.getState().appendMessage({
        senderLabel: "SYSTEM",
        body: unwrapped.error,
        outgoing: false,
      });
      return;
    }

    const parsed = parseDataChannelPayload(unwrapped.data);
    if (parsed.type === "text") {
      useChatSessionStore.getState().appendMessage({
        senderLabel: label,
        body: parsed.text,
        outgoing: false,
        messageKind: "text",
      });
      return;
    }

    const a = parsed.attachment;
    const bytes = estimateBytesFromBase64(a.base64);
    if (bytes > MAX_ATTACHMENT_BYTES) {
      useChatSessionStore.getState().appendMessage({
        senderLabel: "SYSTEM",
        body: "Peer sent an attachment over the size limit; ignored.",
        outgoing: false,
      });
      return;
    }

    const dataUri = `data:${a.mime};base64,${a.base64}`;
    useChatSessionStore.getState().appendMessage({
      senderLabel: label,
      body: a.name,
      outgoing: false,
      messageKind: a.kind,
      mime: a.mime,
      attachmentName: a.name,
      mediaUri: a.kind === "image" ? dataUri : undefined,
      attachmentBase64: a.kind === "file" ? a.base64 : undefined,
    });
  }

  send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    useChatSessionStore.getState().appendMessage({
      senderLabel: this.user.userId,
      body: trimmed,
      outgoing: true,
      at: chatTimestamp(),
      messageKind: "text",
    });
    void this.sendRawPayload(this.wrapOutgoing(trimmed));
  }

  sendAttachment(payload: {
    kind: "image" | "file";
    mime: string;
    name: string;
    base64: string;
    localUri?: string;
  }) {
    const bytes = estimateBytesFromBase64(payload.base64);
    if (bytes > MAX_ATTACHMENT_BYTES) {
      useChatSessionStore.getState().appendMessage({
        senderLabel: "SYSTEM",
        body: "Attachment too large (max ~1.7 MB file size).",
        outgoing: false,
      });
      return;
    }
    const wire = buildAttachmentWire({
      kind: payload.kind,
      mime: payload.mime,
      name: payload.name,
      base64: payload.base64,
    });

    useChatSessionStore.getState().appendMessage({
      senderLabel: this.user.userId,
      body: payload.name,
      outgoing: true,
      at: chatTimestamp(),
      messageKind: payload.kind,
      mime: payload.mime,
      attachmentName: payload.name,
      mediaUri: payload.localUri,
      attachmentBase64: payload.kind === "file" ? payload.base64 : undefined,
    });
    void this.sendRawPayload(this.wrapOutgoing(wire));
  }

  private scheduleLookupTimeout() {
    this.clearLookupTimeout();
    this.lookupTimer = setTimeout(() => {
      this.lookupTimer = null;
      const s = useChatSessionStore.getState();
      if (s.connectionStatus !== "lookup") return;
      s.setError("BLE lookup timed out. Move peers closer and retry.");
      s.setConnectionStatus("error");
    }, LOOKUP_RESPONSE_TIMEOUT_MS);
  }

  private clearLookupTimeout() {
    if (this.lookupTimer) {
      clearTimeout(this.lookupTimer);
      this.lookupTimer = null;
    }
  }

  private clearScanTimer() {
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
  }

  stop() {
    this.clearLookupTimeout();
    this.clearScanTimer();
    this.manager.stopDeviceScan();
    this.monitorSub?.remove();
    this.monitorSub = null;
    if (this.connectedDevice) {
      void this.manager.cancelDeviceConnection(this.connectedDevice.id).catch(
        () => undefined,
      );
      this.connectedDevice = null;
    }
    this.manager.destroy();
    this.incomingById.clear();
  }
}

let activeSession: BluetoothChatSession | null = null;

export function startBluetoothChatSession(opts: {
  user: User;
  role: "host" | "join";
  peerHash?: string;
}) {
  activeSession?.stop();
  const session = new BluetoothChatSession(opts.user, opts.role, opts.peerHash);
  activeSession = session;
  void session.start();
  return session;
}

export function stopBluetoothChatSession() {
  activeSession?.stop();
  activeSession = null;
  useChatSessionStore.getState().reset();
}

export function sendBluetoothChatMessage(text: string) {
  activeSession?.send(text);
}

export function sendBluetoothChatAttachment(payload: {
  kind: "image" | "file";
  mime: string;
  name: string;
  base64: string;
  localUri?: string;
}) {
  activeSession?.sendAttachment(payload);
}
