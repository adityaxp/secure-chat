# secure Chat

P2P chat app built with Expo + React Native.

Supports two uplink modes:

- **Online chat**: peer discovery/signaling over WebSocket + P2P data channel
- **Local chat**: Bluetooth Low Energy (BLE) chat using `react-native-ble-plx`

---

> BLE and WebRTC native modules require a **custom dev build** rather than Expo Go.

---

## Setup

```bash
npm install
```

Create `.env` in project root:

```env
EXPO_PUBLIC_SIGNALING_URL=ws://<your-ip>:8080
# or
# EXPO_PUBLIC_SIGNALING_WS_URL=ws://<your-ip>:8080
```

The app reads either variable from `services/env.ts`.

---

## Run

Start Metro:

```bash
npm run start
```

Build and run on device/emulator:

```bash
npm run android
# or
npm run ios
```

Run lint:

```bash
npm run lint
```

---

## Signaling Server

Check out <a href="https://github.com/adityaxp/secure-chat-signaling">secure-chat-signaling</a>

---

## BLE Notes

- BLE requires Bluetooth enabled and runtime permissions.
- For best reliability, test on two physical devices nearby.
- Current BLE service uses UART-like UUIDs inside `services/chatSessionBluetooth.ts`.
- If your peer peripheral uses different service/characteristic UUIDs, update:
  - `CHAT_SERVICE_UUID`
  - `CHAT_TX_CHAR_UUID`
  - `CHAT_RX_CHAR_UUID`

---

## Project Scripts

- `npm run start` - start Metro
- `npm run android` - build + run Android
- `npm run ios` - build + run iOS
- `npm run web` - web preview (limited for native features)
- `npm run lint` - lint project

---

## Folder structure

- `app/` - routes/screens (`onboarding`, `user`, `chat`)
- `services/chatSession.ts` - internet/WebRTC session logic
- `services/chatSessionBluetooth.ts` - BLE session logic
- `store/` - Zustand stores for user/chat/session state

---
