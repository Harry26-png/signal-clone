"use client";

import type { ReactNode } from "react";
import { ChatsIcon, MenuIcon, PhoneIcon, SettingsIcon, StoriesIcon } from "@/components/common/icons";
import { useChatStore } from "@/store/chat";
import { type NavTab, useUIStore } from "@/store/ui";
import styles from "./layout.module.css";

function NavItem({
  tab,
  label,
  renderIcon,
  badge,
}: {
  tab: NavTab;
  label: string;
  /** Signal fills the icon of the active tab. */
  renderIcon: (active: boolean) => ReactNode;
  badge?: number;
}) {
  const active = useUIStore((s) => s.tab === tab);
  const setTab = useUIStore((s) => s.setTab);
  return (
    <button
      className={styles.navItem}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      title={label}
      onClick={() => setTab(tab)}
    >
      {renderIcon(active)}
      <span className={styles.navLabel}>{label}</span>
      {!!badge && <span className={styles.navBadge}>{badge > 99 ? "99+" : badge}</span>}
    </button>
  );
}

const fillWhen = (active: boolean) => (active ? "currentColor" : "none");

export function NavRail() {
  const unread = useChatStore((s) =>
    Object.values(s.conversations).reduce((sum, c) => sum + c.unread_count, 0),
  );
  const toggleNav = useUIStore((s) => s.toggleNav);

  return (
    <nav className={styles.nav} aria-label="Main">
      <button className={`${styles.navItem} ${styles.navToggle}`} aria-label="Close navigation" title="Close navigation" onClick={toggleNav}>
        <MenuIcon size={22} />
      </button>
      <NavItem tab="chats" label="Chats" badge={unread} renderIcon={(a) => <ChatsIcon size={22} fill={fillWhen(a)} />} />
      <NavItem tab="calls" label="Calls" renderIcon={(a) => <PhoneIcon size={22} fill={fillWhen(a)} />} />
      <NavItem tab="stories" label="Stories" renderIcon={(a) => <StoriesIcon size={22} fill={fillWhen(a)} />} />
      <div className={styles.navSpacer} />
      <NavItem tab="settings" label="Settings" renderIcon={() => <SettingsIcon size={22} />} />
    </nav>
  );
}

/** Shown in pane headers while the nav rail is collapsed, to bring it back. */
export function NavExpandButton() {
  const collapsed = useUIStore((s) => s.navCollapsed);
  const toggleNav = useUIStore((s) => s.toggleNav);
  if (!collapsed) return null;
  return (
    <button className={`${styles.navItem} ${styles.navExpand}`} aria-label="Open navigation" title="Open navigation" onClick={toggleNav}>
      <MenuIcon size={22} />
    </button>
  );
}
