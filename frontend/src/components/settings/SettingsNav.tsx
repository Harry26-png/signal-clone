"use client";

import type { ReactNode } from "react";
import { UserAvatar } from "@/components/common/Avatar";
import {
  BellIcon,
  ChatsIcon,
  DevicesIcon,
  KeyboardIcon,
  LogoutIcon,
  PaletteIcon,
  ShieldIcon,
  SlidersIcon,
} from "@/components/common/icons";
import { PaneHeader } from "@/components/sidebar/PaneHeader";
import { formatPhone } from "@/lib/format";
import { useSessionStore } from "@/store/session";
import { type SettingsSection, useUIStore } from "@/store/ui";
import styles from "./settings.module.css";

const SECTIONS: { id: SettingsSection; label: string; icon: ReactNode }[] = [
  { id: "general", label: "General", icon: <SlidersIcon /> },
  { id: "appearance", label: "Appearance", icon: <PaletteIcon /> },
  { id: "chats", label: "Chats", icon: <ChatsIcon /> },
  { id: "notifications", label: "Notifications", icon: <BellIcon /> },
  { id: "privacy", label: "Privacy", icon: <ShieldIcon /> },
  { id: "devices", label: "Linked devices", icon: <DevicesIcon /> },
];

export function SettingsNav() {
  const me = useSessionStore((s) => s.me);
  const signOut = useSessionStore((s) => s.signOut);
  const section = useUIStore((s) => s.settingsSection);
  const setSection = useUIStore((s) => s.setSettingsSection);
  const openModal = useUIStore((s) => s.openModal);

  return (
    <div className={styles.pane}>
      <PaneHeader title="Settings" />
      <div className={styles.navList}>
        <button
          className={styles.profileCard}
          aria-current={section === "profile" ? "page" : undefined}
          onClick={() => setSection("profile")}
        >
          <UserAvatar user={me ?? undefined} size={48} />
          <span>
            <span className={styles.profileName}>{me?.display_name}</span>
            <span className={styles.profileSub}>{me && formatPhone(me.phone)}</span>
          </span>
        </button>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className={styles.navItem}
            aria-current={section === s.id ? "page" : undefined}
            onClick={() => setSection(s.id)}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
        <div className={styles.divider} />
        <button className={styles.navItem} onClick={() => openModal({ type: "shortcuts" })}>
          <KeyboardIcon />
          Keyboard shortcuts
        </button>
        <button
          className={`${styles.navItem} ${styles.danger}`}
          onClick={() =>
            openModal({
              type: "confirm",
              title: "Log out?",
              body: "You'll need to verify your phone number again to sign back in. Your chats stay on the server.",
              confirmLabel: "Log out",
              danger: true,
              onConfirm: signOut,
            })
          }
        >
          <LogoutIcon />
          Log out
        </button>
      </div>
    </div>
  );
}
