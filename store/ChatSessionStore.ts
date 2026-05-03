import { create } from "zustand";

export type ChatMessageType = "text" | "image" | "file";

export type ChatLine = {
  id: string;
  at: string;
  senderLabel: string;
  /** Plain text, or filename/caption summary for attachments */
  body: string;
  outgoing?: boolean;
  messageKind?: ChatMessageType;
  mime?: string;
  attachmentName?: string;
  /** file:// or data: URI for image preview */
  mediaUri?: string;
  /** Raw base64 for `file` attachments (download / share). */
  attachmentBase64?: string;
};

export type ChatConnectionStatus =
  | "idle"
  | "signaling"
  | "waiting"
  | "lookup"
  | "negotiating"
  | "connected"
  | "error";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function chatTimestamp(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

type ChatSessionStoreState = {
  messages: ChatLine[];
  connectionStatus: ChatConnectionStatus;
  errorMessage: string | null;
  remotePeerId: string | null;
  appendMessage: (
    line: Omit<ChatLine, "id" | "at"> & Partial<Pick<ChatLine, "id" | "at">>,
  ) => void;
  setConnectionStatus: (s: ChatConnectionStatus) => void;
  setError: (e: string | null) => void;
  setRemotePeerId: (id: string | null) => void;
  reset: () => void;
};

export const useChatSessionStore = create<ChatSessionStoreState>((set, get) => ({
  messages: [],
  connectionStatus: "idle",
  errorMessage: null,
  remotePeerId: null,
  appendMessage: (partial) => {
    const id =
      partial.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const at = partial.at ?? chatTimestamp();
    set({
      messages: [...get().messages, { ...partial, id, at } as ChatLine],
    });
  },
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setError: (errorMessage) => set({ errorMessage }),
  setRemotePeerId: (remotePeerId) => set({ remotePeerId }),
  reset: () =>
    set({
      messages: [],
      connectionStatus: "idle",
      errorMessage: null,
      remotePeerId: null,
    }),
}));
