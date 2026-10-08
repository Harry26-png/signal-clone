"use client";

import { useEffect } from "react";
import { tokenStorage } from "@/lib/api";
import { conversationTitle, messagePreview } from "@/lib/conversation";
import { RealtimeClient } from "@/lib/socket";
import type { ClientEvent, Message, ServerEvent } from "@/lib/types";
import { isViewing, useChatStore } from "@/store/chat";
import { useSessionStore } from "@/store/session";
import { toast, useUIStore } from "@/store/ui";

let client: RealtimeClient | null = null;

/** Send an event over the shared socket (no-op while disconnected; typing is best-effort). */
export function sendRealtime(event: ClientEvent) {
  client?.send(event);
}

function notify(message: Message) {
  const { prefs } = useUIStore.getState();
  if (!prefs.notifications || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (isViewing(message.conversation_id) && document.hasFocus()) return;

  const chat = useChatStore.getState();
  const meId = useSessionStore.getState().me?.id ?? 0;
  const conversation = chat.conversations[message.conversation_id];
  if (!conversation) return;
  const sender = message.sender_id ? chat.users[message.sender_id]?.display_name : "";
  const title = conversationTitle(conversation, meId, chat.users);
  const text = messagePreview(message, meId, chat.users);
  const notification = new Notification(title, {
    body: prefs.notificationPreview
      ? conversation.kind === "group"
        ? `${sender}: ${text}`
        : text
      : "New message",
    tag: `conversation-${conversation.id}`,
  });
  notification.onclick = () => {
    window.focus();
    useUIStore.getState().setTab("chats");
    useChatStore.getState().setActive(conversation.id);
  };
}

function handleEvent(event: ServerEvent) {
  const chat = useChatStore.getState();
  const meId = useSessionStore.getState().me?.id;

  switch (event.type) {
    case "message.new": {
      const { message } = event;
      chat.receiveMessage(message);
      if (message.sender_id !== meId && message.kind === "text") {
        sendRealtime({ type: "delivered", message_ids: [message.id] });
        notify(message);
      }
      break;
    }
    case "message.status":
      chat.applyStatusUpdates(event.updates);
      break;
    case "message.reactions":
      chat.setReactions(event.conversation_id, event.message_id, event.reactions);
      break;
    case "message.deleted":
      chat.removeMessages(event.conversation_id, event.message_ids);
      break;
    case "conversation.updated":
      void chat.refreshConversation(event.conversation_id);
      break;
    case "conversation.removed": {
      const conversation = chat.conversations[event.conversation_id];
      chat.removeConversation(event.conversation_id);
      if (conversation?.kind === "group") toast(`You are no longer a member of “${conversation.title}”`);
      break;
    }
    case "conversation.read":
      chat.clearUnread(event.conversation_id);
      break;
    case "typing":
      chat.setTyping(event.conversation_id, event.user_id, event.is_typing);
      break;
    case "presence":
      chat.setPresence(event.user_id, event.online, event.last_seen_at);
      break;
    case "user.updated":
      chat.upsertUser(event.user);
      if (event.user.id === meId) useSessionStore.getState().setMe(event.user);
      break;
  }
}

/** Owns the WebSocket for the signed-in session and routes server events into the stores. */
export function useRealtime() {
  useEffect(() => {
    const token = tokenStorage.get();
    if (!token) return;
    const ui = useUIStore.getState();
    const realtime = new RealtimeClient(token, {
      onEvent: handleEvent,
      onStateChange: ui.setConnection,
      onReconnect: () => void useChatStore.getState().loadInitial(),
      onUnauthorized: () => useSessionStore.getState().expire(),
    });
    client = realtime;
    realtime.connect();
    return () => {
      realtime.close();
      if (client === realtime) client = null;
    };
  }, []);
}
