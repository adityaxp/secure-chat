import { RTCPeerConnection } from "react-native-webrtc";

class WebRTCService {
  pc: RTCPeerConnection;
  dataChannel: RTCDataChannel | null = null;

  constructor() {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    this.setupListeners();
  }

  private setupListeners() {
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("🧊 ICE Candidate:", event.candidate);
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log("🔗 Connection state:", this.pc.connectionState);
    };

    this.pc.ondatachannel = (event) => {
      console.log("📡 Data channel received");
      this.dataChannel = event.channel;
      this.setupDataChannel();
    };
  }

  createDataChannel() {
    this.dataChannel = this.pc.createDataChannel("chat");

    this.setupDataChannel();
  }

  private setupDataChannel() {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log("🟢 Data channel open");
    };

    this.dataChannel.onmessage = (event) => {
      console.log("📩 Message:", event.data);
    };

    this.dataChannel.onclose = () => {
      console.log("🔴 Data channel closed");
    };
  }
}

export default WebRTCService;
