import { create } from "zustand";
import type { ConnectionState } from "@/lib/socket";

export type NavTab = "chats" | "calls" | "stories" | "settings";

/** Sub-views of the left pane in the Chats tab (Signal swaps the pane instead of opening dialogs). */
export type LeftView =
  | { name: "list" }
  | { name: "compose" }
  | { name: "newGroup" }
  | { name: "find"; mode: "phone" | "username" };

export type SettingsSection =
  | "profile"
  | "general"
  | "appearance"
  | "chats"
  | "notifications"
  | "privacy"
  | "devices";

export type Modal =
  | { type: "shortcuts" }
  | { type: "whatsNew" }
  | { type: "comingSoon"; feature: string }
  | { type: "safetyNumber"; conversationId: number }
  | { type: "disappearing"; conversationId: number }
  | { type: "addMembers"; conversationId: number }
  | { type: "editGroup"; conversationId: number }
  | {
      type: "confirm";
      title: string;
      body: string;
      confirmLabel: string;
      danger?: boolean;
      onConfirm: () => void | Promise<void>;
    };

export type ThemePref = "system" | "light" | "dark";

export interface Prefs {
  theme: ThemePref;
  notifications: boolean;
  notificationPreview: boolean;
}

const PREFS_KEY = "signal-clone.prefs";
const DEFAULT_PREFS: Prefs = { theme: "system", notifications: true, notificationPreview: true };

export function readStoredPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}

interface Toast {
  id: number;
  text: string;
}

interface UIState {
  tab: NavTab;
  leftView: LeftView;
  settingsSection: SettingsSection;
  /** Mobile only: a settings section is open full-screen (vs. the section list). */
  settingsSectionOpen: boolean;
  showDetails: boolean;
  /** Desktop: the nav rail is hidden via its ☰ toggle, as in Signal Desktop. */
  navCollapsed: boolean;
  modal: Modal | null;
  toasts: Toast[];
  search: string;
  unreadOnly: boolean;
  searchFocusRequest: number;
  connection: ConnectionState;
  prefs: Prefs;

  setTab: (tab: NavTab) => void;
  setLeftView: (view: LeftView) => void;
  setSettingsSection: (section: SettingsSection) => void;
  closeSettingsSection: () => void;
  setShowDetails: (show: boolean) => void;
  toggleNav: () => void;
  openModal: (modal: Modal) => void;
  closeModal: () => void;
  toast: (text: string) => void;
  dismissToast: (id: number) => void;
  setSearch: (search: string) => void;
  toggleUnreadOnly: () => void;
  focusSearch: () => void;
  setConnection: (state: ConnectionState) => void;
  loadPrefs: () => void;
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  reset: () => void;
}

let toastSeq = 0;
const TOAST_MS = 3500;

export const useUIStore = create<UIState>((set, get) => ({
  tab: "chats",
  leftView: { name: "list" },
  settingsSection: "profile",
  settingsSectionOpen: false,
  showDetails: false,
  navCollapsed: false,
  modal: null,
  toasts: [],
  search: "",
  unreadOnly: false,
  searchFocusRequest: 0,
  connection: "connecting",
  prefs: DEFAULT_PREFS,

  setTab: (tab) => set({ tab, leftView: { name: "list" }, settingsSectionOpen: false }),
  setLeftView: (leftView) => set({ leftView, tab: "chats" }),
  setSettingsSection: (settingsSection) => set({ settingsSection, tab: "settings", settingsSectionOpen: true }),
  closeSettingsSection: () => set({ settingsSectionOpen: false }),
  setShowDetails: (showDetails) => set({ showDetails }),
  toggleNav: () => set((s) => ({ navCollapsed: !s.navCollapsed })),
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),

  toast: (text) => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text }] }));
    setTimeout(() => get().dismissToast(id), TOAST_MS);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  setSearch: (search) => set({ search }),
  toggleUnreadOnly: () => set((s) => ({ unreadOnly: !s.unreadOnly })),
  focusSearch: () =>
    set((s) => ({ tab: "chats", leftView: { name: "list" }, searchFocusRequest: s.searchFocusRequest + 1 })),
  setConnection: (connection) => set({ connection }),

  loadPrefs: () => set({ prefs: readStoredPrefs() }),
  setPref: (key, value) => {
    const prefs = { ...get().prefs, [key]: value };
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    set({ prefs });
  },

  reset: () =>
    set({
      tab: "chats",
      leftView: { name: "list" },
      showDetails: false,
      modal: null,
      search: "",
      unreadOnly: false,
    }),
}));

export const toast = (text: string) => useUIStore.getState().toast(text);
export const comingSoon = (feature: string) => useUIStore.getState().openModal({ type: "comingSoon", feature });
