import { create } from "zustand";

import { deriveAesKeyFromPassphrase, pairSessionSalt } from "@/utils/chatE2e";

type ChatE2eStore = {
  /** AES-256 key derived from passphrase; never persisted. */
  key: Uint8Array | null;
  setPassphrase: (
    passphrase: string,
    localUserId: string,
    remotePeerId: string,
  ) => void;
  clearKey: () => void;
};

export const useChatE2eStore = create<ChatE2eStore>((set) => ({
  key: null,
  setPassphrase: (passphrase, localUserId, remotePeerId) => {
    const p = passphrase.trim();
    const local = localUserId.trim();
    const remote = remotePeerId.trim();
    if (p.length < 6 || !local || !remote) {
      set({ key: null });
      return;
    }
    const salt = pairSessionSalt(local, remote);
    set({ key: deriveAesKeyFromPassphrase(p, salt) });
  },
  clearKey: () => set({ key: null }),
}));
