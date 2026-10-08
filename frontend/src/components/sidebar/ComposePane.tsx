"use client";

import { useState } from "react";
import { AtIcon, GroupIcon, HashIcon } from "@/components/common/icons";
import { useContacts } from "@/hooks/selectors";
import { api, ApiError } from "@/lib/api";
import { useChatStore } from "@/store/chat";
import { toast, useUIStore } from "@/store/ui";
import { ActionRow, ContactRow } from "./ContactRow";
import { PaneHeader } from "./PaneHeader";
import { SearchBox } from "./SearchBox";
import styles from "./sidebar.module.css";

/** "New chat": pick a contact, or jump to group creation / find-by-number / find-by-username. */
export function ComposePane() {
  const setLeftView = useUIStore((s) => s.setLeftView);
  const contacts = useContacts();
  const openDirect = useChatStore((s) => s.openDirect);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? contacts.filter(
        (u) =>
          u.display_name.toLowerCase().includes(q) ||
          u.username?.includes(q) ||
          u.phone.includes(q.replace(/[^\d+]/g, "") || "\u0000"),
      )
    : contacts;
  const looksLikeNumber = /^\+?[\d\s\-()]{6,}$/.test(q);

  const start = async (userId: number) => {
    await openDirect(userId);
    setLeftView({ name: "list" });
  };

  const startByQuery = async () => {
    try {
      const user = await api.users.lookup(q.startsWith("+") ? q : `+${q.replace(/\D/g, "")}`);
      await start(user.id);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "No Signal user found");
    }
  };

  return (
    <div className={styles.pane}>
      <PaneHeader title="New chat" onBack={() => setLeftView({ name: "list" })} />
      <SearchBox value={query} onChange={setQuery} placeholder="Name, username, or number" autoFocus />
      <div className={styles.list}>
        {!q && (
          <>
            <ActionRow icon={<GroupIcon size={18} />} label="New group" onClick={() => setLeftView({ name: "newGroup" })} />
            <ActionRow
              icon={<AtIcon size={18} />}
              label="Find by username"
              onClick={() => setLeftView({ name: "find", mode: "username" })}
            />
            <ActionRow
              icon={<HashIcon size={18} />}
              label="Find by phone number"
              onClick={() => setLeftView({ name: "find", mode: "phone" })}
            />
          </>
        )}
        {looksLikeNumber && <ActionRow icon={<HashIcon size={18} />} label={`Message ${query.trim()}`} onClick={startByQuery} />}
        {filtered.length > 0 && <h2 className={styles.sectionTitle}>Contacts</h2>}
        {filtered.map((u) => (
          <ContactRow key={u.id} user={u} onClick={() => void start(u.id)} />
        ))}
        {q && filtered.length === 0 && !looksLikeNumber && <p className={styles.emptyList}>No contacts found</p>}
      </div>
    </div>
  );
}
