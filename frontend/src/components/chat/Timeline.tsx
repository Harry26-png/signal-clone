"use client";

import { type ReactNode, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ConversationAvatar, UserAvatar } from "@/components/common/Avatar";
import { Spinner } from "@/components/common/Button";
import { ArrowDownIcon, GroupIcon, LockIcon, TimerIcon } from "@/components/common/icons";
import { useNow } from "@/hooks/useNow";
import { conversationTitle, describeSystemMessage, otherMember } from "@/lib/conversation";
import { formatDayDivider, formatMessageTime, formatPhone, isSameDay } from "@/lib/format";
import type { Conversation, Message } from "@/lib/types";
import { useChatStore } from "@/store/chat";
import { useMeId } from "@/store/session";
import { toast } from "@/store/ui";
import styles from "./chat.module.css";
import { MessageBubble } from "./MessageBubble";

const CLUSTER_GAP_MS = 3 * 60_000;
const NEAR_BOTTOM_PX = 120;
const LOAD_OLDER_PX = 150;
const EMPTY: Message[] = [];

/** Messages from the same sender, same day, a few minutes apart form one visual cluster. */
function continues(a: Message | undefined, b: Message | undefined): boolean {
  return (
    !!a &&
    !!b &&
    a.kind === "text" &&
    b.kind === "text" &&
    a.sender_id === b.sender_id &&
    isSameDay(a.created_at, b.created_at) &&
    Math.abs(new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) < CLUSTER_GAP_MS
  );
}

function Hero({ conversation }: { conversation: Conversation }) {
  const meId = useMeId();
  const users = useChatStore((s) => s.users);
  const other = otherMember(conversation, meId, users);
  const isGroup = conversation.kind === "group";
  return (
    <div className={styles.hero}>
      <ConversationAvatar conversation={conversation} other={other} size={80} />
      <h2 className={styles.heroName}>{conversationTitle(conversation, meId, users)}</h2>
      {isGroup ? (
        <span className={styles.heroSub}>
          {conversation.members.length} members{conversation.description ? ` · ${conversation.description}` : ""}
        </span>
      ) : (
        other && (
          <>
            {other.about && <span className={styles.heroSub}>{other.about}</span>}
            <span className={styles.heroSub}>
              {formatPhone(other.phone)}
              {other.username ? ` · @${other.username}` : ""}
            </span>
          </>
        )
      )}
      <div className={styles.heroNotice}>
        <LockIcon size={14} />
        <span>
          Messages and calls are end-to-end encrypted. No one outside of this chat can read or listen to them.
          (Encryption is simulated in this demo.)
        </span>
      </div>
    </div>
  );
}

export function Timeline({ conversation }: { conversation: Conversation }) {
  const meId = useMeId();
  const id = conversation.id;
  const timeline = useChatStore((s) => s.timelines[id]);
  const users = useChatStore((s) => s.users);
  const typingIds = useChatStore((s) => s.typing[id]);
  const unreadAtOpen = useChatStore((s) => s.unreadAtOpen);
  const loadOlder = useChatStore((s) => s.loadOlder);

  const items = timeline?.items ?? EMPTY;
  const hasExpiring = items.some((m) => m.expires_at);
  // Tick every second while disappearing messages are on screen so they vanish on time.
  const now = useNow(hasExpiring ? 1000 : 30_000);
  const visible = useMemo(
    () => items.filter((m) => !m.expires_at || new Date(m.expires_at) > now),
    [items, now],
  );

  const scroller = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const heightBeforePrepend = useRef(0);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Freeze the "unread messages" divider position the first time this chat's messages load.
  const divider = useRef<number | null | undefined>(undefined);
  if (divider.current === undefined && timeline?.loaded) {
    const incoming = items.filter((m) => m.kind === "text" && m.sender_id !== meId);
    divider.current = unreadAtOpen > 0 ? (incoming[incoming.length - unreadAtOpen]?.id ?? null) : null;
  }
  const dividerId = divider.current ?? null;

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Initial position: the unread divider if there is one, otherwise the newest message.
  useLayoutEffect(() => {
    if (!timeline?.loaded) return;
    const marker = scroller.current?.querySelector("[data-unread-divider]");
    if (marker) marker.scrollIntoView({ block: "center" });
    else scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline?.loaded]);

  // Follow new messages when already at the bottom (or when we sent them).
  const last = visible[visible.length - 1];
  const lastKey = last ? (last.client_id ?? last.id) : null;
  useLayoutEffect(() => {
    if (last && (nearBottom.current || last.sender_id === meId)) scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastKey, typingIds?.length]);

  // Keep the viewport anchored when older messages are prepended.
  const firstId = visible[0]?.id;
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && heightBeforePrepend.current) {
      el.scrollTop += el.scrollHeight - heightBeforePrepend.current;
      heightBeforePrepend.current = 0;
    }
  }, [firstId]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    setShowScrollDown(!nearBottom.current);
    if (el.scrollTop < LOAD_OLDER_PX && timeline?.hasMore && !timeline.loading) {
      heightBeforePrepend.current = el.scrollHeight;
      void loadOlder(id);
    }
  };

  const jumpTo = useCallback((messageId: number) => {
    const node = scroller.current?.querySelector(`[data-message-id="${messageId}"]`);
    if (!node) {
      toast("Original message not found");
      return;
    }
    node.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightId(messageId);
    setTimeout(() => setHighlightId(null), 1300);
  }, []);

  const isGroup = conversation.kind === "group";
  const nodes: ReactNode[] = [];
  visible.forEach((message, i) => {
    const prev = visible[i - 1];
    const next = visible[i + 1];
    if (!prev || !isSameDay(prev.created_at, message.created_at)) {
      nodes.push(
        <div key={`day-${message.id}`} className={styles.dateDivider}>
          {formatDayDivider(message.created_at, now)}
        </div>,
      );
    }
    if (message.id === dividerId) {
      nodes.push(
        <div key="unread" className={styles.unreadDivider} data-unread-divider>
          {unreadAtOpen} Unread Message{unreadAtOpen === 1 ? "" : "s"}
        </div>,
      );
    }
    if (message.kind === "system") {
      nodes.push(
        <div key={message.id} className={styles.systemMessage} data-message-id={message.id}>
          {message.body.includes("timer_changed") ? <TimerIcon size={16} /> : <GroupIcon size={16} />}
          {describeSystemMessage(message, meId, users)}
        </div>,
      );
      return;
    }
    const clusterStart = !continues(prev, message) || message.id === dividerId;
    const clusterEnd = !continues(message, next) || next?.id === dividerId;
    const showMeta =
      clusterEnd ||
      message.status === "failed" ||
      formatMessageTime(message.created_at, now) !== formatMessageTime(next!.created_at, now) ||
      (message.sender_id === meId && message.status !== next!.status);
    const sender = message.sender_id !== null ? users[message.sender_id] : undefined;
    nodes.push(
      <MessageBubble
        key={message.client_id ?? message.id}
        message={message}
        meId={meId}
        sender={sender}
        isGroup={isGroup}
        showSenderName={isGroup && clusterStart && message.sender_id !== meId}
        showAvatar={clusterEnd}
        clusterStart={clusterStart}
        clusterEnd={clusterEnd}
        showMeta={showMeta}
        now={now}
        highlighted={highlightId === message.id}
        onQuoteClick={jumpTo}
        onImageClick={setLightbox}
      />,
    );
  });

  const typingUser = typingIds?.length ? users[typingIds[0]] : undefined;

  return (
    <>
      <div
        className={styles.timeline}
        ref={scroller}
        onScroll={onScroll}
        onLoadCapture={() => nearBottom.current && scrollToBottom()}
        role="log"
        aria-live="polite"
        aria-label="Messages"
      >
        <div className={styles.timelineSpacer} />
        {timeline?.loading && (
          <div className={styles.loadingOlder}>
            <Spinner />
          </div>
        )}
        {timeline?.loaded && !timeline.hasMore && <Hero conversation={conversation} />}
        {nodes}
        {typingUser && (
          <div className={`${styles.row} ${styles.incoming} ${styles.clusterStart} ${styles.clusterEnd}`}>
            {isGroup && (
              <span className={styles.avatarSlot}>
                <UserAvatar user={typingUser} size={28} />
              </span>
            )}
            <div className={styles.typingBubble} aria-label={`${typingUser.display_name} is typing`}>
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </div>
      {showScrollDown && (
        <button className={styles.scrollDown} onClick={() => scrollToBottom(true)} aria-label="Scroll to bottom">
          <ArrowDownIcon size={18} />
        </button>
      )}
      {lightbox && (
        <div className={styles.lightbox} onClick={() => setLightbox(null)} role="dialog" aria-label="Image preview">
          <img src={lightbox} alt="" />
        </div>
      )}
    </>
  );
}
