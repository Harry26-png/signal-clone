"use client";

import { useState } from "react";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { withToast } from "@/components/details/useGroupActions";
import { useConversation } from "@/hooks/selectors";
import { api } from "@/lib/api";
import { useChatStore } from "@/store/chat";
import styles from "./modals.module.css";

export function EditGroupModal({ conversationId, onClose }: { conversationId: number; onClose: () => void }) {
  const conversation = useConversation(conversationId);
  const [title, setTitle] = useState(conversation?.title ?? "");
  const [description, setDescription] = useState(conversation?.description ?? "");
  if (!conversation) return null;

  const save = async () => {
    await withToast(async () => {
      useChatStore
        .getState()
        .upsertConversation(await api.conversations.update(conversationId, { title: title.trim(), description }));
    });
    onClose();
  };

  return (
    <Modal
      title="Edit group"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!title.trim()} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <label className={styles.label} htmlFor="group-name">
        Group name
      </label>
      <input
        id="group-name"
        className={styles.field}
        value={title}
        maxLength={64}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <label className={styles.label} htmlFor="group-description">
        Description
      </label>
      <input
        id="group-description"
        className={styles.field}
        value={description}
        maxLength={255}
        placeholder="Add a group description"
        onChange={(e) => setDescription(e.target.value)}
      />
    </Modal>
  );
}
