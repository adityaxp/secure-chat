import type { User } from "@/store/UserStore";

import { getSignalingWsUrl } from "./env";
import SignalingService from "./signaling";

let active: InternetNode | null = null;

/**
 * Registers this client on the signaling server as a node and sends a test `hello`.
 * If your server only accepts `register` / SDP messages, ignore or strip `hello` server-side.
 */
export class InternetNode {
  private readonly signaling: SignalingService;
  private readonly user: User;

  constructor(signalingUrl: string, user: User) {
    this.user = user;
    this.signaling = new SignalingService(signalingUrl);
  }

  connect() {
    this.signaling.onMessage((msg) => {
      if (msg?.type === "hello") {
        console.log("📩 Signaling hello from:", msg.from, msg.payload ?? "");
      }
    });

    this.signaling.connect(this.user.userId, {
      profile: {
        userType: this.user.userType,
        uplinkType: this.user.uplinkType,
        userHash: this.user.userHash,
      },
      onOpen: () => {
        this.signaling.send({
          type: "hello",
          from: this.user.userId,
          payload: {
            text: "hello",
            userType: this.user.userType,
            uplinkType: this.user.uplinkType,
            userHash: this.user.userHash,
          },
        });
        console.log("👋 Sent hello over signaling (test)");
      },
    });
  }

  stop() {
    this.signaling.disconnect();
  }
}

export function startInternetNode(user: User): InternetNode | null {
  const url = getSignalingWsUrl();
  if (!url) {
    console.warn(
      "[internetNode] Missing EXPO_PUBLIC_SIGNALING_URL (or EXPO_PUBLIC_SIGNALING_WS_URL) in .env",
    );
    return null;
  }

  active?.stop();
  const node = new InternetNode(url, user);
  active = node;
  node.connect();
  return node;
}

export function stopInternetNode() {
  active?.stop();
  active = null;
}
