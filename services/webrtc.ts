import { RTCPeerConnection } from "react-native-webrtc";

type SessionDescriptionLike = {
  type: "offer" | "answer" | "pranswer" | "rollback";
  sdp?: string;
};

type IceCandidateLike = {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
};

type WebRTCServiceOptions = {
  isCaller?: boolean;
  stunUrl?: string;
  onIceCandidate?: (candidate: IceCandidateLike) => void;
  onConnectionStateChange?: (state: string) => void;
  onIceConnectionStateChange?: (state: string) => void;
  onConnected?: () => void;
  onDataOpen?: () => void;
  onDataMessage?: (message: string) => void;
  onDataClose?: () => void;
};

/**
 * Lightweight wrapper over react-native-webrtc APIs.
 * Types are intentionally relaxed because RN WebRTC TS definitions are incomplete.
 */
export class WebRTCService {
  private pc: any;
  private dataChannel: any | null = null;
  private pendingCandidates: IceCandidateLike[] = [];
  private hasReportedConnected = false;
  private readonly options: WebRTCServiceOptions;

  constructor(options: WebRTCServiceOptions = {}) {
    this.options = options;
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: options.stunUrl ?? "stun:stun.l.google.com:19302" }],
    } as any);

    this.setupPeerConnectionListeners();

    if (options.isCaller) {
      this.createDataChannel();
    } else {
      this.pc.ondatachannel = (event: any) => {
        this.dataChannel = event.channel;
        this.setupDataChannelHandlers();
      };
    }
  }

  private setupPeerConnectionListeners() {
    this.pc.onicecandidate = (event: any) => {
      if (!event?.candidate) return;
      const candidate = event.candidate.toJSON
        ? event.candidate.toJSON()
        : event.candidate;
      console.log("🧊 ICE Candidate:", candidate);
      this.options.onIceCandidate?.(candidate);
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      console.log("🔗 Connection state:", state);
      this.options.onConnectionStateChange?.(state);

      if (state === "connected" && !this.hasReportedConnected) {
        this.hasReportedConnected = true;
        console.log("✅ Peer connection fully connected");
        this.options.onConnected?.();
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc.iceConnectionState;
      console.log("🧭 ICE connection state:", state);
      this.options.onIceConnectionStateChange?.(state);
    };
  }

  private async flushPendingCandidates(): Promise<void> {
    if (!this.pendingCandidates.length) return;
    const queued = [...this.pendingCandidates];
    this.pendingCandidates = [];

    for (const candidate of queued) {
      try {
        await this.pc.addIceCandidate(candidate as any);
      } catch (error) {
        console.log("⚠️ Failed to add queued ICE candidate:", error);
      }
    }
  }

  private createDataChannel() {
    this.dataChannel = this.pc.createDataChannel("chat", {
      ordered: true,
    });
    this.setupDataChannelHandlers();
  }

  private setupDataChannelHandlers() {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log("📡 Data channel open");
      this.options.onDataOpen?.();
    };

    this.dataChannel.onmessage = (event: any) => {
      const text =
        typeof event?.data === "string"
          ? event.data
          : String(event?.data ?? "");
      console.log("💬 Data channel message:", text);
      this.options.onDataMessage?.(text);
    };

    this.dataChannel.onclose = () => {
      console.log("❌ Data channel closed");
      this.options.onDataClose?.();
    };

    this.dataChannel.onerror = (error: any) => {
      console.log("⚠️ Data channel error:", error);
    };
  }

  async createOffer(): Promise<SessionDescriptionLike> {
    if (!this.dataChannel) {
      this.createDataChannel();
    }
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  // Receiver path
  async handleOffer(
    offer: SessionDescriptionLike,
  ): Promise<SessionDescriptionLike> {
    await this.pc.setRemoteDescription(offer as any);
    await this.flushPendingCandidates();
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  // Caller receives answer
  async handleAnswer(answer: SessionDescriptionLike): Promise<void> {
    await this.pc.setRemoteDescription(answer as any);
    await this.flushPendingCandidates();
  }

  async addIceCandidate(candidate: IceCandidateLike): Promise<void> {
    if (!candidate?.candidate) return;
    if (!this.pc.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }
    await this.pc.addIceCandidate(candidate as any);
  }

  send(message: string) {
    if (!this.dataChannel || this.dataChannel.readyState !== "open") {
      console.log("⚠️ Data channel not open; message not sent");
      return;
    }
    this.dataChannel.send(message);
  }

  close() {
    this.pendingCandidates = [];
    this.hasReportedConnected = false;

    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {
        // no-op
      }
      this.dataChannel = null;
    }

    if (this.pc) {
      try {
        this.pc.close();
      } catch {
        // no-op
      }
    }
  }
}

export default WebRTCService;
