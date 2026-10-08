import { create } from "zustand";
import { api, setUnauthorizedHandler, tokenStorage } from "@/lib/api";
import type { AuthResponse, User } from "@/lib/types";
import { useChatStore } from "./chat";

type SessionStatus = "loading" | "signedOut" | "onboarding" | "signedIn";

interface SessionState {
  status: SessionStatus;
  me: User | null;
  /** Restore a persisted session on page load. */
  bootstrap: () => Promise<void>;
  signIn: (auth: AuthResponse) => void;
  setMe: (user: User) => void;
  finishOnboarding: (user: User) => void;
  signOut: () => Promise<void>;
  /** Local-only sign out, used when the server rejects our token. */
  expire: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  status: "loading",
  me: null,

  bootstrap: async () => {
    if (!tokenStorage.get()) {
      set({ status: "signedOut" });
      return;
    }
    try {
      const me = await api.users.me();
      set({ me, status: me.display_name ? "signedIn" : "onboarding" });
    } catch {
      get().expire();
    }
  },

  signIn: ({ token, user, is_new_user }) => {
    tokenStorage.set(token);
    set({ me: user, status: is_new_user ? "onboarding" : "signedIn" });
  },

  setMe: (user) => set({ me: user }),

  finishOnboarding: (user) => set({ me: user, status: "signedIn" }),

  signOut: async () => {
    try {
      await api.auth.logout();
    } catch {
      /* the local session is cleared regardless */
    }
    get().expire();
  },

  expire: () => {
    tokenStorage.clear();
    useChatStore.getState().reset();
    set({ me: null, status: "signedOut" });
  },
}));

setUnauthorizedHandler(() => useSessionStore.getState().expire());

/** Current user's id; only call from components rendered while signed in. */
export function useMeId(): number {
  return useSessionStore((s) => s.me?.id ?? 0);
}
