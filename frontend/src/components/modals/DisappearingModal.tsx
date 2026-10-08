"use client";

import { useState } from "react";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { withToast } from "@/components/details/useGroupActions";
import { useConversation } from "@/hooks/selectors";
import { api } from "@/lib/api";
import { DISAPPEARING_OPTIONS } from "@/lib/format";
import { useChatStore } from "@/store/chat";
import styles from "./modals.module.css";

export function DisappearingModal({ conversationId, onClose }: { conversationId: number; onClose: () => void }) {
  const conversation = useConversation(conversationId);
  const [seconds, setSeconds] = useState(conversation?.disappearing_seconds ?? 0);
  if (!conversation) return null;

  const save = async () => {
    if (seconds !== conversation.disappearing_seconds) {
      await withToast(async () => {
        useChatStore.getState().upsertConversation(
          await api.conversations.update(conversationId, { disappearing_seconds: seconds }),
        );
      });
    }
    onClose();
  };

  return (
    <Modal
      title="Disappearing messages"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </>
      }
    >
      <p className={styles.text}>
        When enabled, new messages sent and received in this chat will disappear after they have been sent.
      </p>
      <div className={styles.options} role="radiogroup">
        {DISAPPEARING_OPTIONS.map((option) => (
          <button
            key={option.seconds}
            className={styles.option}
            role="radio"
            aria-checked={seconds === option.seconds}
            onClick={() => setSeconds(option.seconds)}
          >
            <span className={styles.radio} data-checked={seconds === option.seconds} />
            {option.label}
          </button>
        ))}
      </div>
    </Modal>
  );
}
