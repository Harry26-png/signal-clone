"use client";

import { useState } from "react";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { SHORTCUTS } from "@/hooks/useKeyboardShortcuts";
import { useUIStore } from "@/store/ui";
import { AddMembersModal } from "./AddMembersModal";
import { DisappearingModal } from "./DisappearingModal";
import { EditGroupModal } from "./EditGroupModal";
import styles from "./modals.module.css";
import { SafetyNumberModal } from "./SafetyNumberModal";

function ConfirmModal({
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={danger ? "destructive" : "primary"}
            disabled={busy}
            autoFocus
            onClick={async () => {
              setBusy(true);
              await onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className={styles.text}>{body}</p>
    </Modal>
  );
}

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose} width={480}>
      <table className={styles.shortcuts}>
        <tbody>
          {SHORTCUTS.map((s) => (
            <tr key={s.description}>
              <td>{s.description}</td>
              <td>
                {s.keys.map((k) => (
                  <kbd key={k} className={styles.key}>
                    {k === "Ctrl" && isMac ? "⌘" : k}
                  </kbd>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

/** Renders whichever modal is open in the UI store. */
export function ModalHost() {
  const modal = useUIStore((s) => s.modal);
  const close = useUIStore((s) => s.closeModal);
  if (!modal) return null;

  switch (modal.type) {
    case "confirm":
      return <ConfirmModal {...modal} onClose={close} />;
    case "shortcuts":
      return <ShortcutsModal onClose={close} />;
    case "whatsNew":
      return (
        <Modal title="What's new" onClose={close} footer={<Button onClick={close}>OK</Button>}>
          <ul className={styles.text}>
            <li>Reply to a message by hovering it and choosing Reply.</li>
            <li>React with emoji, or attach photos and files with the + button.</li>
            <li>Set disappearing messages from a chat's ⋯ menu.</li>
            <li>Press Ctrl + / to see every keyboard shortcut.</li>
          </ul>
        </Modal>
      );
    case "comingSoon":
      return (
        <Modal title={modal.feature} onClose={close} footer={<Button onClick={close}>OK</Button>}>
          <p className={styles.text}>{modal.feature} are coming soon to this Signal clone.</p>
        </Modal>
      );
    case "safetyNumber":
      return <SafetyNumberModal conversationId={modal.conversationId} onClose={close} />;
    case "disappearing":
      return <DisappearingModal conversationId={modal.conversationId} onClose={close} />;
    case "addMembers":
      return <AddMembersModal conversationId={modal.conversationId} onClose={close} />;
    case "editGroup":
      return <EditGroupModal conversationId={modal.conversationId} onClose={close} />;
  }
}
