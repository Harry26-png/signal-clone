"use client";

import { memo, useState } from "react";
import { UserAvatar } from "@/components/common/Avatar";
import { MessageStatusIcon } from "@/components/common/MessageStatusIcon";
import { CopyIcon, EmojiIcon, FileIcon, MoreIcon, ReplyIcon, TimerIcon } from "@/components/common/icons";
import { Menu } from "@/components/common/Menu";
import { api, assetUrl } from "@/lib/api";
import { senderNameColorVars } from "@/lib/avatar";
import { attachmentLabel, displayName } from "@/lib/conversation";
import { formatFileSize, formatMessageTime } from "@/lib/format";
import type { Message, ReplyPreview, User } from "@/lib/types";
import { useChatStore } from "@/store/chat";
import { toast } from "@/store/ui";
import styles from "./chat.module.css";

export const REACTION_EMOJI = ["❤️", "👍", "👎", "😂", "😮", "😢"];

// The trailing class keeps sentence punctuation ("see https://x.com.") out of the link.
const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

/** Renders URLs as links, like Signal. React escapes the text, so this is safe from injection. */
function Linkified({ text }: { text: string }) {
  // split() with a capturing group puts the matched URLs at the odd indexes.
  return (
    <>
      {text.split(URL_RE).map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} className={styles.link} href={part} target="_blank" rel="noopener noreferrer">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** Short all-emoji messages render large, as in Signal. */
const BIG_EMOJI = /^(\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s){1,8}$/u;
const isBigEmoji = (text: string) => text.length <= 16 && BIG_EMOJI.test(text) && !/^[\d\s#*]+$/.test(text);

interface BubbleProps {
  message: Message;
  meId: number;
  sender?: User;
  showSenderName: boolean;
  showAvatar: boolean;
  isGroup: boolean;
  clusterStart: boolean;
  clusterEnd: boolean;
  showMeta: boolean;
  now: Date;
  highlighted: boolean;
  onQuoteClick: (messageId: number) => void;
  onImageClick: (url: string) => void;
}

function Quote({
  quote,
  meId,
  onClick,
}: {
  quote: ReplyPreview;
  meId: number;
  onClick: () => void;
}) {
  const author = useChatStore((s) => (quote.sender_id ? s.users[quote.sender_id] : undefined));
  const image = quote.attachment?.content_type.startsWith("image/") ? assetUrl(quote.attachment.url) : undefined;
  return (
    <button className={styles.quote} onClick={onClick}>
      <span className={styles.quoteBar} />
      <span className={styles.quoteBody}>
        <span className={styles.quoteAuthor}>{quote.sender_id === meId ? "You" : displayName(author)}</span>
        <span className={styles.quoteText}>
          {quote.body || (quote.attachment ? attachmentLabel(quote.attachment.content_type) : "")}
        </span>
      </span>
      {image && <img className={styles.quoteThumb} src={image} alt="" />}
    </button>
  );
}

function Reactions({ message, meId }: { message: Message; meId: number }) {
  const users = useChatStore((s) => s.users);
  if (message.reactions.length === 0) return null;
  const distinct = [...new Set(message.reactions.map((r) => r.emoji))].slice(0, 3);
  const mine = message.reactions.find((r) => r.user_id === meId);
  const who = message.reactions
    .map((r) => `${r.emoji} ${r.user_id === meId ? "You" : displayName(users[r.user_id])}`)
    .join("\n");
  return (
    <button
      className={styles.reactions}
      data-mine={!!mine}
      title={mine ? `${who}\n\nClick to remove your reaction` : who}
      onClick={() => mine && api.messages.unreact(message.id).catch(() => toast("Couldn't remove reaction"))}
    >
      {distinct.join("")}
      {message.reactions.length > 1 && <span className={styles.reactionCount}>{message.reactions.length}</span>}
    </button>
  );
}

function MessageActions({ message, meId }: { message: Message; meId: number }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const setReplyTo = useChatStore((s) => s.setReplyTo);
  const confirmed = message.id > 0;
  const myReaction = message.reactions.find((r) => r.user_id === meId)?.emoji;

  const react = (emoji: string) => {
    setPickerOpen(false);
    const request = emoji === myReaction ? api.messages.unreact(message.id) : api.messages.react(message.id, emoji);
    request.catch(() => toast("Couldn't react to message"));
  };
  const reply = () => setReplyTo(message.conversation_id, message);

  if (!confirmed) return null;
  return (
    <div className={styles.actions} data-open={pickerOpen} onMouseLeave={() => setPickerOpen(false)}>
      {pickerOpen && (
        <div className={styles.reactionPicker} role="menu" aria-label="React">
          {REACTION_EMOJI.map((emoji) => (
            <button
              key={emoji}
              className={styles.reactionOption}
              aria-pressed={emoji === myReaction}
              onClick={() => react(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      <button className={styles.actionButton} aria-label="React" title="React" onClick={() => setPickerOpen((o) => !o)}>
        <EmojiIcon size={18} />
      </button>
      <button className={styles.actionButton} aria-label="Reply" title="Reply" onClick={reply}>
        <ReplyIcon size={18} />
      </button>
      <Menu
        align={message.sender_id === meId ? "right" : "left"}
        placement="above"
        trigger={({ toggle }) => (
          <button className={styles.actionButton} aria-label="More actions" title="More actions" onClick={toggle}>
            <MoreIcon size={18} />
          </button>
        )}
        items={[
          { label: "Reply", icon: <ReplyIcon size={18} />, onSelect: reply },
          ...(message.body
            ? [
                {
                  label: "Copy text",
                  icon: <CopyIcon size={18} />,
                  onSelect: () =>
                    navigator.clipboard.writeText(message.body).then(() => toast("Copied to clipboard")),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}

export const MessageBubble = memo(function MessageBubble({
  message,
  meId,
  sender,
  showSenderName,
  showAvatar,
  isGroup,
  clusterStart,
  clusterEnd,
  showMeta,
  now,
  highlighted,
  onQuoteClick,
  onImageClick,
}: BubbleProps) {
  const retry = useChatStore((s) => s.retryMessage);
  const outgoing = message.sender_id === meId;
  const attachment = message.attachment;
  const isImage = attachment?.content_type.startsWith("image/");
  const bigEmoji = !attachment && !message.reply_to && isBigEmoji(message.body);
  const mediaOnly = isImage && !message.body && !message.reply_to && !showSenderName;

  const rowClass = [
    styles.row,
    outgoing ? styles.outgoing : styles.incoming,
    clusterStart && styles.clusterStart,
    clusterEnd && styles.clusterEnd,
    message.reactions.length > 0 && styles.hasReactions,
    highlighted && styles.highlight,
  ]
    .filter(Boolean)
    .join(" ");

  const meta = showMeta && (
    <span className={styles.meta}>
      {message.expires_at && <TimerIcon size={12} aria-label="Disappearing message" />}
      {formatMessageTime(message.created_at, now)}
      {outgoing && (
        <MessageStatusIcon
          status={message.status}
          knockout={bigEmoji ? "var(--bg-chat)" : "var(--bubble-out)"}
          size={12}
        />
      )}
    </span>
  );

  return (
    <div className={rowClass} data-message-id={message.id}>
      {isGroup && !outgoing && (
        <span className={styles.avatarSlot}>{showAvatar && <UserAvatar user={sender} size={28} />}</span>
      )}
      <div className={styles.bubbleColumn}>
        <div
          className={[
            styles.bubble,
            attachment && styles.withMedia,
            mediaOnly && styles.mediaOnly,
            message.status === "failed" && styles.failed,
            bigEmoji && styles.emojiOnly,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {showSenderName && (
            <span
              className={styles.senderName}
              style={senderNameColorVars(sender?.avatar_color ?? "A200") as React.CSSProperties}
            >
              {displayName(sender)}
            </span>
          )}
          {message.reply_to && (
            <Quote quote={message.reply_to} meId={meId} onClick={() => onQuoteClick(message.reply_to!.id)} />
          )}
          {attachment &&
            (isImage ? (
              <img
                className={styles.image}
                src={assetUrl(attachment.url)}
                alt={attachment.file_name}
                onClick={() => onImageClick(assetUrl(attachment.url)!)}
              />
            ) : (
              <a className={styles.file} href={assetUrl(attachment.url)} download={attachment.file_name} target="_blank" rel="noreferrer">
                <span className={styles.fileIcon}>
                  <FileIcon size={20} />
                </span>
                <span>
                  <span className={styles.fileName}>{attachment.file_name}</span>
                  <span className={styles.fileSize}>{formatFileSize(attachment.size_bytes)}</span>
                </span>
              </a>
            ))}
          {message.body && (
            <span className={`${styles.text} ${bigEmoji ? styles.bigEmoji : ""}`}>
              <Linkified text={message.body} />
            </span>
          )}
          {meta}
          <span className={styles.clear} />
        </div>
        <Reactions message={message} meId={meId} />
        {message.status === "failed" && (
          <span className={styles.failedNote}>
            Failed to send
            <button onClick={() => message.client_id && retry(message.conversation_id, message.client_id)}>Retry</button>
          </span>
        )}
      </div>
      <MessageActions message={message} meId={meId} />
    </div>
  );
});
