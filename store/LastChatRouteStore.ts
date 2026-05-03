import { create } from "zustand";

export type LastChatRoute = {
  role: "host" | "join";
  peerHash?: string;
};

type LastChatRouteStore = {
  lastChatRoute: LastChatRoute | null;
  setLastChatRoute: (route: LastChatRoute | null) => void;
};

/**
 * Survives leaving the chat screen (e.g. globe → user) so the NODE card can
 * re-open the same host/join session. Cleared on /disconnect.
 */
export const useLastChatRouteStore = create<LastChatRouteStore>((set) => ({
  lastChatRoute: null,
  setLastChatRoute: (lastChatRoute) => set({ lastChatRoute }),
}));
