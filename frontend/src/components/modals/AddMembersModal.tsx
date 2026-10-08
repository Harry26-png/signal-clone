"use client";

import { useState } from "react";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { withToast } from "@/components/details/useGroupActions";
import { ContactRow } from "@/components/sidebar/ContactRow";
import { SearchBox } from "@/components/sidebar/SearchBox";
import { useContacts, useConversation } from "@/hooks/selectors";
import { api } from "@/lib/api";
import { useChatStore } from "@/store/chat";
import styles from "./modals.module.css";

export function AddMembersModal({ conversationId, onClose }: { conversationId: number; onClose: () => void }) {
  const conversation = useConversation(conversationId);
  const contacts = useContacts();
  const [selected, setSelected] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  if (!conversation) return null;

  const memberIds = new Set(conversation.members.map((m) => m.user_id));
  const q = query.trim().toLowerCase();
  const candidates = contacts.filter(
    (u) => !memberIds.has(u.id) && (!q || u.display_name.toLowerCase().includes(q)),
  );
  const toggle = (id: number) =>
    setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const add = async () => {
    setBusy(true);
    await withToast(async () => {
      useChatStore.getState().upsertConversation(await api.conversations.addMembers(conversationId, selected));
    }, `Added ${selected.length} member${selected.length === 1 ? "" : "s"}`);
    onClose();
  };

  return (
    <Modal
      title="Add members"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || selected.length === 0} onClick={add}>
            Add{selected.length ? ` (${selected.length})` : ""}
          </Button>
        </>
      }
    >
      <div style={{ margin: "0 -16px" }}>
        <SearchBox value={query} onChange={setQuery} placeholder="Search contacts" autoFocus />
      </div>
      <div className={styles.memberList}>
        {candidates.map((u) => (
          <ContactRow key={u.id} user={u} checked={selected.includes(u.id)} onClick={() => toggle(u.id)} />
        ))}
        {candidates.length === 0 && <p className={styles.empty}>All your contacts are already in this group.</p>}
      </div>
    </Modal>
  );
}
