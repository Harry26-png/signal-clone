"use client";

import { type ClipboardEvent, type KeyboardEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { IconButton } from "@/components/common/Button";
import { CloseIcon, EmojiIcon, FileIcon, MicIcon, PlusIcon, SendIcon } from "@/components/common/icons";
import { sendRealtime } from "@/hooks/useRealtime";
import { assetUrl } from "@/lib/api";
import { attachmentLabel, displayName } from "@/lib/conversation";
import { formatFileSize } from "@/lib/format";
import { useChatStore } from "@/store/chat";
import { useMeId } from "@/store/session";
import { comingSoon, toast } from "@/store/ui";
import styles from "./chat.module.css";
import { EmojiPicker } from "./EmojiPicker";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const TYPING_IDLE_MS = 3000;
const TYPING_REFRESH_MS = 3000;

/** Emits typing start/stop events with throttling, like Signal (start, periodic refresh, stop on idle/send). */
function useTypingSignal(conversationId: number) {
  const lastSent = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const stop = useCallback(() => {
    clearTimeout(idleTimer.current);
    if (lastSent.current) {
      sendRealtime({ type: "typing", conversation_id: conversationId, is_typing: false });
      lastSent.current = 0;
    }
  }, [conversationId]);

  const ping = useCallback(() => {
    const now = Date.now();
    if (now - lastSent.current > TYPING_REFRESH_MS) {
      sendRealtime({ type: "typing", conversation_id: conversationId, is_typing: true });
      lastSent.current = now;
    }
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stop, TYPING_IDLE_MS);
  }, [conversationId, stop]);

  useEffect(() => stop, [stop]);
  return { ping, stop };
}

export function Composer({ conversationId }: { conversationId: number }) {
  const meId = useMeId();
  const draft = useChatStore((s) => s.drafts[conversationId] ?? "");
  const replyTo = useChatStore((s) => s.replyTo[conversationId] ?? null);
  const replyAuthor = useChatStore((s) => (replyTo?.sender_id ? s.users[replyTo.sender_id] : undefined));
  const { setDraft, setReplyTo, sendMessage } = useChatStore.getState();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const typing = useTypingSignal(conversationId);

  useEffect(() => {
    // On touch devices focusing would pop up the on-screen keyboard on every chat open.
    if (replyTo || !window.matchMedia("(pointer: coarse)").matches) textarea.current?.focus();
  }, [conversationId, replyTo]);

  // Auto-grow the textarea up to its CSS max-height.
  useLayoutEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const stage = (candidate: File | undefined) => {
    if (!candidate) return;
    if (candidate.size > MAX_FILE_BYTES) {
      toast("Files must be 10 MB or smaller");
      return;
    }
    setFile(candidate);
    textarea.current?.focus();
  };

  const canSend = draft.trim().length > 0 || file !== null;

  const send = () => {
    if (!canSend) return;
    typing.stop();
    void sendMessage(conversationId, { body: draft, file, replyTo });
    setFile(null);
    setEmojiOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };

  const onPaste = (event: ClipboardEvent) => {
    const pasted = Array.from(event.clipboardData.files)[0];
    if (pasted) {
      event.preventDefault();
      stage(pasted);
    }
  };

  const insertEmoji = (emoji: string) => {
    const el = textarea.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    setDraft(conversationId, draft.slice(0, start) + emoji + draft.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const closeEmoji = useCallback(() => setEmojiOpen(false), []);

  return (
    <div className={styles.composer}>
      {emojiOpen && <EmojiPicker onPick={insertEmoji} onClose={closeEmoji} />}
      <div className={styles.composerRow}>
        <button className={styles.composerButton} aria-label="Emoji" title="Emoji" onClick={() => setEmojiOpen((o) => !o)}>
          <EmojiIcon />
        </button>
        <div className={styles.inputShell}>
          {replyTo && (
            <div className={styles.composerQuote}>
              <span className={styles.quoteBar} />
              <span className={styles.quoteBody}>
                <span className={styles.quoteAuthor}>
                  {replyTo.sender_id === meId ? "You" : displayName(replyAuthor)}
                </span>
                <span className={styles.quoteText}>
                  {replyTo.body || (replyTo.attachment ? attachmentLabel(replyTo.attachment.content_type) : "")}
                </span>
              </span>
              {replyTo.attachment?.content_type.startsWith("image/") && (
                <img className={styles.quoteThumb} src={assetUrl(replyTo.attachment.url)} alt="" />
              )}
              <IconButton label="Cancel reply" className={styles.quoteClose} onClick={() => setReplyTo(conversationId, null)}>
                <CloseIcon size={16} />
              </IconButton>
            </div>
          )}
          {file && (
            <div className={styles.staged}>
              {preview ? (
                <img className={styles.stagedThumb} src={preview} alt="" />
              ) : (
                <span className={styles.fileIcon}>
                  <FileIcon size={20} />
                </span>
              )}
              <span className={styles.stagedName}>
                {file.name}
                <br />
                <small>{formatFileSize(file.size)}</small>
              </span>
              <IconButton label="Remove attachment" onClick={() => setFile(null)}>
                <CloseIcon size={16} />
              </IconButton>
            </div>
          )}
          <textarea
            ref={textarea}
            className={styles.textarea}
            rows={1}
            placeholder="Message"
            value={draft}
            onChange={(e) => {
              setDraft(conversationId, e.target.value);
              if (e.target.value.trim()) typing.ping();
              else typing.stop();
            }}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            aria-label="Message"
          />
        </div>
        <button
          className={styles.composerButton}
          aria-label="Attach file"
          title="Attach file"
          onClick={() => fileInput.current?.click()}
        >
          <PlusIcon />
        </button>
        <input
          ref={fileInput}
          type="file"
          hidden
          onChange={(e) => {
            stage(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {canSend ? (
          <button className={styles.sendButton} aria-label="Send message" title="Send" onClick={send}>
            <SendIcon size={18} />
          </button>
        ) : (
          <button className={styles.composerButton} aria-label="Voice message" title="Voice message" onClick={() => comingSoon("Voice messages")}>
            <MicIcon />
          </button>
        )}
      </div>
    </div>
  );
}
