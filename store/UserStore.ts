import { create } from "zustand";

export interface User {
  userId: string;
  userType: "XX" | "XY";
  uplinkType: "internet" | "local";
  userHash: string;
}
const defaultUser: User = {
  userId: "",
  userType: "XX",
  uplinkType: "local",
  userHash: "",
};

export type UserStore = {
  user: User | null;
  setUser: (user: User) => void;
  setUserId: (userId: string) => void;
  setUserType: (userType: "XX" | "XY") => void;
  setUplinkType: (uplinkType: "internet" | "local") => void;
  setUserHash: (userHash: string) => void;
  resetUser: () => void;
};

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  setUserId: (userId) =>
    set((state) => ({
      user: { ...(state.user ?? defaultUser), userId },
    })),
  setUserType: (userType) =>
    set((state) => ({
      user: { ...(state.user ?? defaultUser), userType },
    })),
  setUplinkType: (uplinkType) =>
    set((state) => ({
      user: { ...(state.user ?? defaultUser), uplinkType },
    })),
  setUserHash: (userHash) =>
    set((state) => ({
      user: { ...(state.user ?? defaultUser), userHash },
    })),
  resetUser: () => set({ user: defaultUser }),
}));
