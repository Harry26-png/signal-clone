"use client";

import { memo } from "react";
import { ConversationAvatar } from "@/components/common/Avatar";
import { MessageStatusIcon } from "@/components/common/MessageStatusIcon";
import { TimerIcon } from "@/components/common/icons";
import { conversationTitle, displayName, messagePreview, otherMember } from "@/lib/conversation";
import { formatListTime } from "@/lib/format";
import { useChatStore } from "@/store/chat";
import { useMeId } from "@/store/session";
import styles from "./sidebar.module.css";

function TypingDots() {
  return (
    <span className={styles.typingPreview} aria-label="Typing">
      <span />
      <span />
      <span />
    </span>
  );
}

export const ConversationRow = memo(function ConversationRow({ id, now }: { id: number; now: Date }) {
  const meId = useMeId();
  const conversation = useChatStore((s) => s.conversations[id]);
  const users = useChatStore((s) => s.users);
  const typingIds = useChatStore((s) => s.typing[id]);
  const draft = useChatStore((s) => s.drafts[id]);
  const selected = useChatStore((s) => s.activeId === id);
  const setActive = useChatStore((s) => s.setActive);
  if (!conversation) return null;

  const other = conversation.kind === "direct" ? otherMember(conversation, meId, users) : undefined;
  const last = conversation.last_message;
  const isMine = last?.sender_id === meId;
  const unread = conversation.unread_count;

  let preview: React.ReactNode = null;
  if (typingIds?.length) {
    preview = <TypingDots />;
  } else if (draft?.trim() && !selected) {
    preview = (
      <>
        <span className={styles.draft}>Draft: </span>
        {draft}
      </>
    );
  } else if (last) {
    const sender = last.sender_id !== null ? users[last.sender_id] : undefined;
    preview = (
      <>
        {isMine && last.kind === "text" && (
          <span className={styles.rowStatus}>
            <MessageStatusIcon status={last.status} knockout={selected ? "var(--bg-selected)" : "var(--bg-pane)"} size={12} />
          </span>
        )}
        {conversation.kind === "group" && !isMine && last.kind === "text" && `${displayName(sender).split(" ")[0]}: `}
        {messagePreview(last, meId, users)}
      </>
    );
  }

  return (
    <button
      className={`${styles.row} ${unread ? styles.rowUnread : ""}`}
      aria-selected={selected}
      onClick={() => setActive(id)}
    >
      <ConversationAvatar conversation={conversation} other={other} size={48} showPresence />
      <span className={styles.rowBody}>
        <span className={styles.rowTop}>
          <span className={styles.rowName}>{conversationTitle(conversation, meId, users)}</span>
          {last && <span className={styles.rowTime}>{formatListTime(last.created_at, now)}</span>}
        </span>
        <span className={styles.rowBottom}>
          <span className={styles.rowPreview}>{preview}</span>
          {conversation.disappearing_seconds > 0 && (
            <span className={styles.timerSmall} title="Disappearing messages on">
              <TimerIcon size={14} />
            </span>
          )}
          {unread > 0 && <span className={styles.unreadBadge}>{unread}</span>}
        </span>
      </span>
    </button>
  );
});
