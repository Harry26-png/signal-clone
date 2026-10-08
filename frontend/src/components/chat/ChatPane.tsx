"use client";

import { useConversation } from "@/hooks/selectors";
import styles from "./chat.module.css";
import { ChatHeader } from "./ChatHeader";
import { Composer } from "./Composer";
import { Timeline } from "./Timeline";

export function ChatPane({ id }: { id: number }) {
  const conversation = useConversation(id);
  if (!conversation) return null;
  return (
    <section className={styles.pane} aria-label="Conversation">
      <ChatHeader conversation={conversation} />
      {/* Keyed so scroll position and the unread divider reset per conversation. */}
      <Timeline key={id} conversation={conversation} />
      <Composer key={`composer-${id}`} conversationId={id} />
    </section>
  );
}
