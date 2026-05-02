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
  | { type: "hello"; from: string; payload?: Record<string, unknown> }
  | { type: "lookup-peer"; from: string; targetHash: string }
  | { type: "peer-found"; peerId: string; targetHash?: string }
  | { type: "peer-not-found"; targetHash: string };

type MessageHandler = (msg: any) => void;

export type SignalingConnectOpts = {
  onOpen?: () => void;
  /** After an automatic reconnect (not the first connect). */
  onReconnect?: () => void;
  profile?: NodeRegisterProfile;
  /** Exponential backoff reconnect when the server drops the socket (e.g. idle / deploy). */
  reconnect?: boolean;
  maxReconnectAttempts?: number;
};

const READY_STATE_LABEL = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];

class SignalingService {
  private ws: WebSocket | null = null;
  private url: string;
  private handler: MessageHandler | null = null;
  private connectArgs: {
    sessionId: string;
    opts?: SignalingConnectOpts;
  } | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string) {
    this.url = url;
  }

  connect(sessionId: string, opts?: SignalingConnectOpts) {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.connectArgs = { sessionId, opts };
    this.reconnectAttempt = 0;

    if (this.ws) {
      this.ws.close();
    }
    this.openSocket(sessionId, opts, false);
  }

  private openSocket(
    sessionId: string,
    opts: SignalingConnectOpts | undefined,
    isReconnect: boolean,
  ) {
    const sock = new WebSocket(this.url);
    this.ws = sock;

    sock.onopen = () => {
      this.reconnectAttempt = 0;

      if (isReconnect) {
        console.log("🟢 Signaling reconnected");
      } else {
        console.log("🟢 Connected to signaling server");
      }

      this.send({
        type: "register",
        from: sessionId,
        ...(opts?.profile ? { profile: opts.profile } : {}),
      });

      if (isReconnect) opts?.onReconnect?.();
      else opts?.onOpen?.();
    };

    sock.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handler?.(data);
      } catch (err) {
        console.log("❌ Invalid message:", err);
      }
    };

    sock.onerror = () => {
      if (this.ws !== sock) return;
      const rs = sock.readyState;
      const label = READY_STATE_LABEL[rs] ?? String(rs);
      console.log(
        `❌ Signaling WebSocket error (${this.url}) readyState=${rs} (${label}) — details are often omitted on native; see close event for code.`,
      );
    };

    sock.onclose = (ev: CloseEvent) => {
      if (this.ws !== sock) return;

      this.ws = null;

      const reason =
        typeof ev.reason === "string" && ev.reason.length > 0
          ? ev.reason
          : "(none)";
      console.log(
        `🔌 Signaling closed code=${ev.code} reason=${reason} clean=${ev.wasClean}`,
      );

      const args = this.connectArgs;
      const wantsReconnect = args?.opts?.reconnect === true;
      if (!wantsReconnect || !args) return;

      const max = args.opts?.maxReconnectAttempts ?? 6;
      if (this.reconnectAttempt >= max) {
        console.log(
          `↻ Signaling reconnect stopped after ${max} attempt(s). Call connect() again if needed.`,
        );
        return;
      }

      this.reconnectAttempt++;
      const delayMs = Math.min(30_000, 1000 * 2 ** (this.reconnectAttempt - 1));
      console.log(
        `↻ Reconnecting signaling in ${delayMs}ms (${this.reconnectAttempt}/${max})`,
      );

      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        if (!this.connectArgs) return;
        const { sessionId: sid, opts: o } = this.connectArgs;
        this.openSocket(sid, o, true);
      }, delayMs);
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
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.connectArgs = null;

    if (this.ws) {
      const sock = this.ws;
      this.ws = null;
      sock.close();
    }
  }
}

export default SignalingService;
