export type NodeRegisterProfile = {
  userType: string;
  uplinkType: string;
  userHash: string;
};

type SignalMessage =
  | { type: "register"; from: string; profile?: NodeRegisterProfile }
  | {
      type: "offer" | "answer" | "ice";
      from: string;
      to: string;
      payload: any;
    }
  | { type: "hello"; from: string; payload?: Record<string, unknown> };

type MessageHandler = (msg: any) => void;

class SignalingService {
  private ws: WebSocket | null = null;
  private url: string;
  private handler: MessageHandler | null = null;

  constructor(url: string) {
    this.url = url;
  }

  connect(
    sessionId: string,
    opts?: { onOpen?: () => void; profile?: NodeRegisterProfile },
  ) {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log("🟢 Connected to signaling server");

      this.send({
        type: "register",
        from: sessionId,
        ...(opts?.profile ? { profile: opts.profile } : {}),
      });

      opts?.onOpen?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handler?.(data);
      } catch (err) {
        console.log("❌ Invalid message:", err);
      }
    };

    this.ws.onerror = (err) => {
      console.log("❌ WS error:", err);
    };

    this.ws.onclose = () => {
      console.log("🔌 Disconnected from signaling server");
    };
  }

  onMessage(handler: MessageHandler) {
    this.handler = handler;
  }

  send(message: SignalMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.log("⚠️ WebSocket not ready");
    }
  }

  disconnect() {
    this.ws?.close();
  }
}

export default SignalingService;
