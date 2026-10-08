"use client";

import { useEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { IconButton } from "@/components/common/Button";
import { ComposeIcon, GroupIcon, MoreIcon, SettingsIcon, CheckIcon } from "@/components/common/icons";
import { Menu } from "@/components/common/Menu";
import { useContacts, useSortedConversations } from "@/hooks/selectors";
import { useNow } from "@/hooks/useNow";
import { conversationTitle } from "@/lib/conversation";
import type { Conversation, User } from "@/lib/types";
import { useChatStore } from "@/store/chat";
import { useMeId } from "@/store/session";
import { useUIStore } from "@/store/ui";
import { ContactRow } from "./ContactRow";
import { ConversationRow } from "./ConversationRow";
import { PaneHeader } from "./PaneHeader";
import { SearchBox } from "./SearchBox";
import styles from "./sidebar.module.css";

function matches(query: string, ...fields: (string | null | undefined)[]) {
  return fields.some((f) => f?.toLowerCase().includes(query));
}

function ConnectionBanner() {
  const connection = useUIStore((s) => s.connection);
  if (connection === "open") return null;
  return (
    <div className={styles.banner} role="status">
      <span className={styles.bannerDot} />
      {connection === "connecting" ? "Connecting…" : "Offline. Messages will sync when you reconnect."}
    </div>
  );
}

export function ConversationListPane() {
  const meId = useMeId();
  const now = useNow();
  const users = useChatStore((s) => s.users);
  const activeId = useChatStore((s) => s.activeId);
  const loaded = useChatStore((s) => s.conversationsLoaded);
  const conversations = useSortedConversations();
  const contacts = useContacts();
  const { search, setSearch, unreadOnly, toggleUnreadOnly, setLeftView, setTab, searchFocusRequest } = useUIStore(
    useShallow((s) => ({
      search: s.search,
      setSearch: s.setSearch,
      unreadOnly: s.unreadOnly,
      toggleUnreadOnly: s.toggleUnreadOnly,
      setLeftView: s.setLeftView,
      setTab: s.setTab,
      searchFocusRequest: s.searchFocusRequest,
    })),
  );
  const searchInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchFocusRequest) searchInput.current?.focus();
  }, [searchFocusRequest]);

  // Direct chats with no messages yet stay hidden until something is sent (except the open one).
  const visible = useMemo(
    () => conversations.filter((c) => c.kind === "group" || c.last_message || c.id === activeId),
    [conversations, activeId],
  );

  const query = search.trim().toLowerCase();
  const results = useMemo(() => {
    if (!query) return null;
    const chats = visible.filter((c: Conversation) => {
      const memberNames = c.members.map((m) => users[m.user_id]?.display_name);
      return matches(query, conversationTitle(c, meId, users), ...(c.kind === "group" ? [] : memberNames));
    });
    const directPartners = new Set(
      chats.filter((c) => c.kind === "direct").flatMap((c) => c.members.map((m) => m.user_id)),
    );
    const people = contacts.filter(
      (u: User) => !directPartners.has(u.id) && matches(query, u.display_name, u.username, u.phone),
    );
    return { chats, people };
  }, [query, visible, contacts, users, meId]);

  const list = unreadOnly ? visible.filter((c) => c.unread_count > 0 || c.id === activeId) : visible;
  const markAllRead = () => {
    const { conversations: all, markRead } = useChatStore.getState();
    Object.values(all)
      .filter((c) => c.unread_count > 0)
      .forEach((c) => markRead(c.id));
  };

  return (
    <div className={styles.pane}>
      <PaneHeader
        title="Chats"
        actions={
          <>
            <IconButton label="New chat" onClick={() => setLeftView({ name: "compose" })}>
              <ComposeIcon />
            </IconButton>
            <Menu
              trigger={({ toggle }) => (
                <IconButton label="More" onClick={toggle}>
                  <MoreIcon />
                </IconButton>
              )}
              items={[
                { label: "New group", icon: <GroupIcon size={18} />, onSelect: () => setLeftView({ name: "newGroup" }) },
                { label: "Mark all as read", icon: <CheckIcon size={18} />, onSelect: markAllRead },
                { label: "Settings", icon: <SettingsIcon size={18} />, onSelect: () => setTab("settings") },
              ]}
            />
          </>
        }
      />
      <SearchBox
        ref={searchInput}
        value={search}
        onChange={setSearch}
        filterActive={unreadOnly}
        onToggleFilter={toggleUnreadOnly}
      />
      {unreadOnly && !results && (
        <div className={styles.filterBanner}>
          Filtered by unread
          <button className={styles.linkButton} onClick={toggleUnreadOnly}>
            Clear
          </button>
        </div>
      )}
      <ConnectionBanner />

      <div className={styles.list} role="listbox" aria-label="Chats">
        {results ? (
          <>
            {results.chats.length > 0 && <h2 className={styles.sectionTitle}>Chats</h2>}
            {results.chats.map((c) => (
              <ConversationRow key={c.id} id={c.id} now={now} />
            ))}
            {results.people.length > 0 && <h2 className={styles.sectionTitle}>Contacts</h2>}
            {results.people.map((u) => (
              <ContactRow
                key={u.id}
                user={u}
                onClick={() => {
                  setSearch("");
                  void useChatStore.getState().openDirect(u.id);
                }}
              />
            ))}
            {results.chats.length === 0 && results.people.length === 0 && (
              <p className={styles.emptyList}>No results for “{search.trim()}”</p>
            )}
          </>
        ) : (
          <>
            {list.map((c) => (
              <ConversationRow key={c.id} id={c.id} now={now} />
            ))}
            {loaded && list.length === 0 && (
              <p className={styles.emptyList}>
                {unreadOnly ? "No unread chats" : "No chats yet. Tap the compose button to start one."}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
