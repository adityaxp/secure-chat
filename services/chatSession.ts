import type { User } from "@/store/UserStore";
import {
  chatTimestamp,
  useChatSessionStore,
} from "@/store/ChatSessionStore";

import { normalizePeerHashForLookup } from "@/utils/hash";
import {
  MAX_ATTACHMENT_BYTES,
  buildAttachmentWire,
  estimateBytesFromBase64,
  parseDataChannelPayload,
} from "@/utils/chatWire";

import { getSignalingWsUrl } from "./env";
import { stopInternetNode } from "./internetNode";
import SignalingService from "./signaling";
import WebRTCService from "./webrtc";

const LOOKUP_RESPONSE_TIMEOUT_MS = 15_000;

export class ChatSession {
  private signaling: SignalingService;
  private webrtc: WebRTCService | null = null;
  private remotePeerId: string | null = null;
  private lookupResponseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly user: User,
    private readonly role: "host" | "join",
    private readonly targetPeerHash: string | undefined,
    private readonly signalingUrl: string,
  ) {
    this.signaling = new SignalingService(signalingUrl);
  }

  start() {
    stopInternetNode();

    const store = useChatSessionStore.getState();
    store.reset();
    store.setConnectionStatus("signaling");

    this.signaling.onMessage((msg) => {
      void this.handleSignalMessage(msg);
    });

    const profile = {
      userType: this.user.userType,
      uplinkType: this.user.uplinkType,
      userHash: this.user.userHash,
    };

    this.signaling.connect(this.user.userId, {
      profile,
      reconnect: true,
      onOpen: () => this.onSignalingReady(false),
      onReconnect: () => this.onSignalingReady(true),
    });
  }

  /** First connect or after signaling reconnect (Render idle, deploy, etc.). */
  private onSignalingReady(isReconnect: boolean) {
    const store = useChatSessionStore.getState();

    if (this.role === "join" && this.targetPeerHash) {
      store.setConnectionStatus("lookup");
      const targetHash = normalizePeerHashForLookup(this.targetPeerHash);
      this.signaling.send({
        type: "lookup-peer",
        from: this.user.userId,
        targetHash,
      });
      this.scheduleLookupTimeout();
      return;
    }

    store.setConnectionStatus("waiting");
    if (!isReconnect) {
      store.appendMessage({
        senderLabel: "SYSTEM",
        body: "Room ready. Share your user hash so a peer can join.",
        outgoing: false,
      });
    }
  }

  private async handleSignalMessage(msg: Record<string, unknown>) {
    const type = msg.type as string;

    switch (type) {
      case "peer-found": {
        this.clearLookupTimeout();
        const peerId = msg.peerId as string;
        this.remotePeerId = peerId;
        useChatSessionStore.getState().setRemotePeerId(peerId);
        await this.startAsCaller(peerId);
        break;
      }
      case "peer-not-found": {
        this.clearLookupTimeout();
        useChatSessionStore.getState().setError(
          "No peer online with that user hash.",
        );
        useChatSessionStore.getState().setConnectionStatus("error");
        break;
      }
      case "offer": {
        const from = msg.from as string;
        const payload = msg.payload;
        await this.onIncomingOffer(from, payload);
        break;
      }
      case "answer": {
        const payload = msg.payload;
        await this.webrtc?.handleAnswer(payload as any);
        break;
      }
      case "ice": {
        const payload = msg.payload;
        await this.webrtc?.addIceCandidate(payload as any);
        break;
      }
      default:
        break;
    }
  }

  private async startAsCaller(peerId: string) {
    if (this.webrtc) return;

    useChatSessionStore.getState().setConnectionStatus("negotiating");

    this.webrtc = new WebRTCService({
      isCaller: true,
      onIceCandidate: (candidate) => {
        this.signaling.send({
          type: "ice",
          from: this.user.userId,
          to: peerId,
          payload: candidate,
        });
      },
      onDataMessage: (text) => {
        this.appendIncomingChat(text);
      },
      onDataOpen: () => {
        useChatSessionStore.getState().setConnectionStatus("connected");
        useChatSessionStore.getState().appendMessage({
          senderLabel: "SYSTEM",
          body: "Encrypted data channel open.",
          outgoing: false,
        });
      },
    });

    const offer = await this.webrtc.createOffer();
    this.signaling.send({
      type: "offer",
      from: this.user.userId,
      to: peerId,
      payload: offer,
    });
  }

  private async onIncomingOffer(fromPeerId: string, payload: unknown) {
    if (this.role !== "host") return;
    if (this.webrtc) return;

    this.remotePeerId = fromPeerId;
    useChatSessionStore.getState().setRemotePeerId(fromPeerId);
    useChatSessionStore.getState().setConnectionStatus("negotiating");

    this.webrtc = new WebRTCService({
      isCaller: false,
      onIceCandidate: (candidate) => {
        this.signaling.send({
          type: "ice",
          from: this.user.userId,
          to: fromPeerId,
          payload: candidate,
        });
      },
      onDataMessage: (text) => {
        this.appendIncomingChat(text);
      },
      onDataOpen: () => {
        useChatSessionStore.getState().setConnectionStatus("connected");
        useChatSessionStore.getState().appendMessage({
          senderLabel: "SYSTEM",
          body: "Encrypted data channel open.",
          outgoing: false,
        });
      },
    });

    const answer = await this.webrtc.handleOffer(payload as any);
    this.signaling.send({
      type: "answer",
      from: this.user.userId,
      to: fromPeerId,
      payload: answer,
    });
  }

  private appendIncomingChat(text: string) {
    const label = this.remotePeerId ?? "PEER";
    const parsed = parseDataChannelPayload(text);

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

    this.webrtc?.send(trimmed);
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

    if (wire.length > 4_000_000) {
      useChatSessionStore.getState().appendMessage({
        senderLabel: "SYSTEM",
        body: "Attachment too large to transmit.",
        outgoing: false,
      });
      return;
    }

    useChatSessionStore.getState().appendMessage({
      senderLabel: this.user.userId,
      body: payload.name,
      outgoing: true,
      at: chatTimestamp(),
      messageKind: payload.kind,
      mime: payload.mime,
      attachmentName: payload.name,
      mediaUri: payload.localUri,
      attachmentBase64:
        payload.kind === "file" ? payload.base64 : undefined,
    });

    this.webrtc?.send(wire);
  }

  private scheduleLookupTimeout() {
    this.clearLookupTimeout();
    this.lookupResponseTimer = setTimeout(() => {
      this.lookupResponseTimer = null;
      const s = useChatSessionStore.getState();
      if (s.connectionStatus !== "lookup") return;
      s.setError(
        "Peer lookup timed out. Your signaling server may not implement lookup-peer yet—deploy the server from scripts/signaling-server.mjs—or the peer is offline.",
      );
      s.setConnectionStatus("error");
    }, LOOKUP_RESPONSE_TIMEOUT_MS);
  }

  private clearLookupTimeout() {
    if (this.lookupResponseTimer) {
      clearTimeout(this.lookupResponseTimer);
      this.lookupResponseTimer = null;
    }
  }

  stop() {
    this.clearLookupTimeout();
    this.signaling.disconnect();
    this.webrtc?.close();
    this.webrtc = null;
    this.remotePeerId = null;
  }
}

let activeSession: ChatSession | null = null;

export function startChatSession(opts: {
  user: User;
  role: "host" | "join";
  peerHash?: string;
}): ChatSession | null {
  const url = getSignalingWsUrl();
  if (!url) {
    useChatSessionStore.getState().setError(
      "Missing EXPO_PUBLIC_SIGNALING_URL in .env",
    );
    useChatSessionStore.getState().setConnectionStatus("error");
    return null;
  }

  activeSession?.stop();
  const session = new ChatSession(
    opts.user,
    opts.role,
    opts.peerHash,
    url,
  );
  activeSession = session;
  session.start();
  return session;
}

export function stopChatSession() {
  activeSession?.stop();
  activeSession = null;
  useChatSessionStore.getState().reset();
}

export function sendChatMessage(text: string) {
  activeSession?.send(text);
}

export function sendChatAttachment(payload: {
  kind: "image" | "file";
  mime: string;
  name: string;
  base64: string;
  localUri?: string;
}) {
  activeSession?.sendAttachment(payload);
}
