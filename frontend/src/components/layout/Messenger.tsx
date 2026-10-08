"use client";

import { useEffect } from "react";
import { ChatPane } from "@/components/chat/ChatPane";
import { EmptyState } from "@/components/common/EmptyState";
import { LockIcon, PhoneIcon, StoriesIcon } from "@/components/common/icons";
import { ConversationDetails } from "@/components/details/ConversationDetails";
import { ModalHost } from "@/components/modals/ModalHost";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { ChatsPane } from "@/components/sidebar/ChatsPane";
import { PlaceholderPane } from "@/components/sidebar/PlaceholderPane";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useRealtime } from "@/hooks/useRealtime";
import { ApiError } from "@/lib/api";
import { useChatStore } from "@/store/chat";
import { toast, useUIStore } from "@/store/ui";
import styles from "./layout.module.css";
import { NavRail } from "./NavRail";

function Welcome() {
  return (
    <div className={styles.welcome}>
      <img src="/icon.svg" alt="" />
      <h2>Welcome to Signal</h2>
      <p>Select a chat on the left, or start a new one with the compose button.</p>
      <div className={styles.welcomeFooter}>
        <LockIcon size={14} /> Your messages are end-to-end encrypted (simulated)
      </div>
    </div>
  );
}

/** Keeps the tab title in sync with the total unread count, like Signal Desktop's badge. */
function useUnreadTitle() {
  const unread = useChatStore((s) => Object.values(s.conversations).reduce((n, c) => n + c.unread_count, 0));
  useEffect(() => {
    document.title = unread ? `(${unread}) Signal` : "Signal";
  }, [unread]);
}

/** Re-sends read receipts when the user returns to a tab that has the conversation open. */
function useReadOnFocus() {
  useEffect(() => {
    const onVisible = () => {
      const { activeId, conversations, markRead } = useChatStore.getState();
      if (document.visibilityState === "visible" && activeId && conversations[activeId]?.unread_count) {
        markRead(activeId);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
}

export function Messenger() {
  const tab = useUIStore((s) => s.tab);
  const showDetails = useUIStore((s) => s.showDetails);
  const settingsSectionOpen = useUIStore((s) => s.settingsSectionOpen);
  const activeId = useChatStore((s) => s.activeId);

  useRealtime();
  useKeyboardShortcuts();
  useUnreadTitle();
  useReadOnFocus();

  useEffect(() => {
    useChatStore
      .getState()
      .loadInitial()
      .catch((e) => toast(e instanceof ApiError ? e.message : "Couldn't load your chats"));
  }, []);

  const mobileShowsMain =
    (tab === "chats" && activeId !== null) || (tab === "settings" && settingsSectionOpen);

  return (
    <div className={styles.app} data-mobile={mobileShowsMain ? "main" : "list"}>
      <NavRail />
      <aside className={styles.leftPane}>
        {tab === "chats" && <ChatsPane />}
        {tab === "calls" && <PlaceholderPane title="Calls" icon={<PhoneIcon size={36} />} feature="Voice and video calls" />}
        {tab === "stories" && (
          <PlaceholderPane title="Stories" icon={<StoriesIcon size={36} />} feature="Stories" />
        )}
        {tab === "settings" && <SettingsNav />}
      </aside>
      <main className={styles.mainPane}>
        {tab === "chats" &&
          (activeId === null ? <Welcome /> : showDetails ? <ConversationDetails id={activeId} /> : <ChatPane id={activeId} />)}
        {tab === "calls" && (
          <EmptyState icon={<PhoneIcon size={36} />} badge="Coming soon" title="Calls" text="Voice and video calls aren't available in this clone yet." />
        )}
        {tab === "stories" && (
          <EmptyState icon={<StoriesIcon size={36} />} badge="Coming soon" title="Stories" text="Share moments that disappear after 24 hours. Coming soon." />
        )}
        {tab === "settings" && <SettingsPage />}
      </main>
      <ModalHost />
    </div>
  );
}
