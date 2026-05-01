import SignalingService from "./signaling";
import WebRTCService from "./webrtc";

export class P2PService {
  private signaling: SignalingService;
  private webrtc: WebRTCService;

  private myId: string;
  private peerId: string;
  private readonly isCaller: boolean;

  constructor(url: string, myId: string, peerId: string, isCaller: boolean) {
    this.myId = myId;
    this.peerId = peerId;
    this.isCaller = isCaller;

    this.signaling = new SignalingService(url);

    this.webrtc = new WebRTCService({
      isCaller,
      onIceCandidate: (candidate) => {
        this.signaling.send({
          type: "ice",
          from: this.myId,
          to: this.peerId,
          payload: candidate,
        });
      },
      onDataMessage: (msg) => {
        console.log("💬 P2P message:", msg);
      },
    });
  }

  start() {
    this.signaling.onMessage(async (msg) => {
      const { type, from, payload } = msg;

      switch (type) {
        case "offer":
          const answer = await this.webrtc.handleOffer(payload);

          this.signaling.send({
            type: "answer",
            from: this.myId,
            to: from,
            payload: answer,
          });
          break;

        case "answer":
          await this.webrtc.handleAnswer(payload);
          break;

        case "ice":
          await this.webrtc.addIceCandidate(payload);
          break;
      }
    });

    this.signaling.connect(this.myId, {
      onOpen: async () => {
        if (this.isCaller) {
          setTimeout(async () => {
            const offer = await this.webrtc.createOffer();

            this.signaling.send({
              type: "offer",
              from: this.myId,
              to: this.peerId,
              payload: offer,
            });
          }, 1000);
        }
      },
    });
  }

  send(message: string) {
    this.webrtc.send(message);
  }

  stop() {
    this.signaling.disconnect();
    this.webrtc.close();
  }
}
