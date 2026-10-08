"use client";

import type { ReactNode } from "react";
import { UserAvatar } from "@/components/common/Avatar";
import { ChatsIcon, PhoneIcon, SettingsIcon, StoriesIcon } from "@/components/common/icons";
import { useChatStore } from "@/store/chat";
import { useSessionStore } from "@/store/session";
import { type NavTab, useUIStore } from "@/store/ui";
import styles from "./layout.module.css";

function NavItem({
  tab,
  label,
  icon,
  badge,
  className,
}: {
  tab: NavTab;
  label: string;
  icon: ReactNode;
  badge?: number;
  className?: string;
}) {
  const active = useUIStore((s) => s.tab === tab);
  const setTab = useUIStore((s) => s.setTab);
  return (
    <button
      className={`${styles.navItem} ${className ?? ""}`}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      title={label}
      onClick={() => setTab(tab)}
    >
      {icon}
      <span className={styles.navLabel}>{label}</span>
      {!!badge && <span className={styles.navBadge}>{badge > 99 ? "99+" : badge}</span>}
    </button>
  );
}

export function NavRail() {
  const me = useSessionStore((s) => s.me);
  const unread = useChatStore((s) =>
    Object.values(s.conversations).reduce((sum, c) => sum + c.unread_count, 0),
  );
  const openProfile = useUIStore((s) => s.setSettingsSection);

  return (
    <nav className={styles.nav} aria-label="Main">
      <NavItem tab="chats" label="Chats" icon={<ChatsIcon size={22} />} badge={unread} />
      <NavItem tab="calls" label="Calls" icon={<PhoneIcon size={22} />} />
      <NavItem tab="stories" label="Stories" icon={<StoriesIcon size={22} />} />
      <div className={styles.navSpacer} />
      <NavItem tab="settings" label="Settings" icon={<SettingsIcon size={22} />} />
      <button
        className={`${styles.navItem} ${styles.navProfile}`}
        aria-label="Profile"
        title="Profile"
        onClick={() => openProfile("profile")}
      >
        <UserAvatar user={me ?? undefined} size={28} />
      </button>
    </nav>
  );
}
