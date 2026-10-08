import { create } from "zustand";
import { api, ApiError } from "@/lib/api";
import { newClientId, type UserMap } from "@/lib/conversation";
import type {
  Conversation,
  ConversationDTO,
  Message,
  MessageStatus,
  Reaction,
  StatusUpdate,
  User,
} from "@/lib/types";
import { useSessionStore } from "./session";
import { toast, useUIStore } from "./ui";

export interface Timeline {
  items: Message[];
  hasMore: boolean;
  loaded: boolean;
  loading: boolean;
}

interface SendInput {
  body: string;
  file?: File | null;
  replyTo?: Message | null;
}

interface ChatState {
  users: UserMap;
  conversations: Record<number, Conversation>;
  conversationsLoaded: boolean;
  contactIds: number[];
  timelines: Record<number, Timeline>;
  /** conversation id -> ids of users currently typing there */
  typing: Record<number, number[]>;
  activeId: number | null;
  /** Unread count of the active chat at the moment it was opened (positions the "unread" divider). */
  unreadAtOpen: number;
  drafts: Record<number, string>;
  replyTo: Record<number, Message | null>;

  reset: () => void;
  loadInitial: () => Promise<void>;
  refreshConversation: (id: number) => Promise<void>;
  upsertConversation: (dto: ConversationDTO) => void;
  removeConversation: (id: number) => void;
  upsertUser: (user: User) => void;
  setPresence: (userId: number, online: boolean, lastSeenAt: string) => void;
  addContact: (user: User) => void;

  setActive: (id: number | null) => void;
  loadMessages: (id: number) => Promise<void>;
  loadOlder: (id: number) => Promise<void>;
  sendMessage: (conversationId: number, input: SendInput) => Promise<void>;
  retryMessage: (conversationId: number, clientId: string) => void;
  receiveMessage: (message: Message) => void;
  applyStatusUpdates: (updates: StatusUpdate[]) => void;
  setReactions: (conversationId: number, messageId: number, reactions: Reaction[]) => void;
  removeMessages: (conversationId: number, messageIds: number[]) => void;
  markRead: (conversationId: number) => void;
  clearUnread: (conversationId: number) => void;
  setTyping: (conversationId: number, userId: number, isTyping: boolean) => void;
  setDraft: (conversationId: number, text: string) => void;
  setReplyTo: (conversationId: number, message: Message | null) => void;

  openDirect: (userId: number) => Promise<number>;
  createGroup: (title: string, memberIds: number[]) => Promise<number>;
}

// ---------- pure helpers ----------

const STATUS_RANK: Record<MessageStatus, number> = { failed: 0, sending: 0, sent: 1, delivered: 2, read: 3 };

/** Receipt events can overtake the HTTP response, so a status never moves backwards. */
function mergeStatus(current: MessageStatus, incoming: MessageStatus): MessageStatus {
  return STATUS_RANK[incoming] >= STATUS_RANK[current] ? incoming : current;
}

/** Confirmed messages are ordered by server id; optimistic ones (negative ids) stay at the end. */
const sortKey = (m: Message) => (m.id < 0 ? Number.MAX_SAFE_INTEGER + m.id : m.id);

function upsertMessage(items: Message[], message: Message): Message[] {
  const index = items.findIndex(
    (m) => m.id === message.id || (message.client_id !== null && m.client_id === message.client_id),
  );
  if (index >= 0) {
    const next = items.slice();
    next[index] = { ...message, status: mergeStatus(items[index].status, message.status) };
    return next.sort((a, b) => sortKey(a) - sortKey(b));
  }
  return [...items, message].sort((a, b) => sortKey(a) - sortKey(b));
}

function isNewer(candidate: Message, current: Message | null): boolean {
  return !current || sortKey(candidate) >= sortKey(current);
}

function normalize(dto: ConversationDTO): { conversation: Conversation; users: User[] } {
  return {
    conversation: {
      ...dto,
      members: dto.members.map((m) => ({ user_id: m.user.id, role: m.role, joined_at: m.joined_at })),
    },
    users: dto.members.map((m) => m.user),
  };
}

const meId = () => useSessionStore.getState().me?.id ?? 0;
const emptyTimeline: Timeline = { items: [], hasMore: true, loaded: false, loading: false };

/** True when the user is actually looking at this conversation (drives read receipts). */
export function isViewing(conversationId: number): boolean {
  return (
    useChatStore.getState().activeId === conversationId &&
    useUIStore.getState().tab === "chats" &&
    typeof document !== "undefined" &&
    document.visibilityState === "visible"
  );
}

let tempId = 0;
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const TYPING_TIMEOUT_MS = 6000;
/** Original inputs of in-flight/failed sends, kept so a failed message can be retried. */
const pendingSends = new Map<string, { conversationId: number; input: SendInput }>();

const initialState = {
  users: {} as UserMap,
  conversations: {} as Record<number, Conversation>,
  conversationsLoaded: false,
  contactIds: [] as number[],
  timelines: {} as Record<number, Timeline>,
  typing: {} as Record<number, number[]>,
  activeId: null as number | null,
  unreadAtOpen: 0,
  drafts: {} as Record<number, string>,
  replyTo: {} as Record<number, Message | null>,
};

export const useChatStore = create<ChatState>((set, get) => {
  const patchTimeline = (id: number, patch: (t: Timeline) => Partial<Timeline>) =>
    set((s) => {
      const timeline = s.timelines[id] ?? emptyTimeline;
      return { timelines: { ...s.timelines, [id]: { ...timeline, ...patch(timeline) } } };
    });

  const patchConversation = (id: number, patch: (c: Conversation) => Partial<Conversation>) =>
    set((s) => {
      const conversation = s.conversations[id];
      return conversation ? { conversations: { ...s.conversations, [id]: { ...conversation, ...patch(conversation) } } } : {};
    });

  /** Put a message into its timeline (if loaded) and refresh the conversation preview. */
  const applyMessage = (message: Message, countAsUnread: boolean) => {
    const id = message.conversation_id;
    if (get().timelines[id]?.loaded) {
      patchTimeline(id, (t) => ({ items: upsertMessage(t.items, message) }));
    }
    patchConversation(id, (c) => {
      const lastIsSame =
        c.last_message &&
        (c.last_message.id === message.id || (message.client_id && c.last_message.client_id === message.client_id));
      const last = lastIsSame
        ? { ...message, status: mergeStatus(c.last_message!.status, message.status) }
        : isNewer(message, c.last_message)
          ? message
          : c.last_message;
      return {
        last_message: last,
        last_activity_at: isNewer(message, c.last_message) ? message.created_at : c.last_activity_at,
        unread_count: c.unread_count + (countAsUnread ? 1 : 0),
      };
    });
  };

  const markFailed = (conversationId: number, clientId: string) => {
    const update = (m: Message) => (m.client_id === clientId ? { ...m, status: "failed" as const } : m);
    patchTimeline(conversationId, (t) => ({ items: t.items.map(update) }));
    patchConversation(conversationId, (c) => ({ last_message: c.last_message && update(c.last_message) }));
  };

  const deliver = async (conversationId: number, clientId: string, input: SendInput) => {
    try {
      const attachmentId = input.file ? (await api.attachments.upload(input.file)).id : null;
      const saved = await api.messages.send(conversationId, {
        body: input.body,
        client_id: clientId,
        reply_to_id: input.replyTo?.id ?? null,
        attachment_id: attachmentId,
      });
      pendingSends.delete(clientId);
      applyMessage(saved, false);
    } catch (error) {
      markFailed(conversationId, clientId);
      toast(error instanceof ApiError ? error.message : "Message failed to send");
    }
  };

  return {
    ...initialState,

    reset: () => {
      typingTimers.forEach(clearTimeout);
      typingTimers.clear();
      pendingSends.clear();
      set(initialState);
    },

    loadInitial: async () => {
      const [dtos, contacts] = await Promise.all([api.conversations.list(), api.contacts.list()]);
      const users: UserMap = {};
      const conversations: Record<number, Conversation> = {};
      for (const dto of dtos) {
        const { conversation, users: members } = normalize(dto);
        conversations[conversation.id] = conversation;
        members.forEach((u) => (users[u.id] = u));
      }
      contacts.forEach((u) => (users[u.id] = u));
      set((s) => ({
        users: { ...s.users, ...users },
        conversations,
        contactIds: contacts.map((u) => u.id),
        conversationsLoaded: true,
        // After a reconnect, cached timelines may be stale; drop all but the open one and refetch it.
        timelines: s.activeId && s.timelines[s.activeId] ? { [s.activeId]: { ...emptyTimeline } } : {},
      }));
      const active = get().activeId;
      if (active) {
        if (!conversations[active]) get().setActive(null);
        else await get().loadMessages(active);
      }
    },

    refreshConversation: async (id) => {
      try {
        get().upsertConversation(await api.conversations.get(id));
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) get().removeConversation(id);
      }
    },

    upsertConversation: (dto) => {
      const { conversation, users } = normalize(dto);
      set((s) => {
        const nextUsers = { ...s.users };
        users.forEach((u) => (nextUsers[u.id] = u));
        return { users: nextUsers, conversations: { ...s.conversations, [conversation.id]: conversation } };
      });
    },

    removeConversation: (id) =>
      set((s) => {
        const conversations = { ...s.conversations };
        const timelines = { ...s.timelines };
        delete conversations[id];
        delete timelines[id];
        return { conversations, timelines, activeId: s.activeId === id ? null : s.activeId };
      }),

    upsertUser: (user) => set((s) => ({ users: { ...s.users, [user.id]: user } })),

    setPresence: (userId, online, lastSeenAt) =>
      set((s) => {
        const user = s.users[userId];
        return user ? { users: { ...s.users, [userId]: { ...user, online, last_seen_at: lastSeenAt } } } : {};
      }),

    addContact: (user) =>
      set((s) => ({
        users: { ...s.users, [user.id]: user },
        contactIds: s.contactIds.includes(user.id) ? s.contactIds : [...s.contactIds, user.id],
      })),

    setActive: (id) => {
      set({ activeId: id, unreadAtOpen: id === null ? 0 : (get().conversations[id]?.unread_count ?? 0) });
      useUIStore.getState().setShowDetails(false);
      if (id !== null) {
        void get().loadMessages(id);
        get().markRead(id);
      }
    },

    loadMessages: async (id) => {
      const timeline = get().timelines[id];
      if (timeline?.loaded || timeline?.loading) return;
      patchTimeline(id, () => ({ loading: true }));
      try {
        const page = await api.messages.list(id);
        patchTimeline(id, (t) => ({
          // Keep optimistic messages that were added while the page was loading.
          items: t.items.filter((m) => m.id < 0).reduce(upsertMessage, page.messages),
          hasMore: page.has_more,
          loaded: true,
          loading: false,
        }));
      } catch (error) {
        patchTimeline(id, () => ({ loading: false }));
        toast(error instanceof ApiError ? error.message : "Couldn't load messages");
      }
    },

    loadOlder: async (id) => {
      const timeline = get().timelines[id];
      if (!timeline?.loaded || !timeline.hasMore || timeline.loading) return;
      const oldest = timeline.items.find((m) => m.id > 0);
      patchTimeline(id, () => ({ loading: true }));
      try {
        const page = await api.messages.list(id, oldest?.id);
        patchTimeline(id, (t) => ({
          items: [...page.messages, ...t.items],
          hasMore: page.has_more,
          loading: false,
        }));
      } catch {
        patchTimeline(id, () => ({ loading: false }));
      }
    },

    sendMessage: async (conversationId, input) => {
      const clientId = newClientId();
      const { file, replyTo } = input;
      const optimistic: Message = {
        id: -++tempId,
        conversation_id: conversationId,
        sender_id: meId(),
        kind: "text",
        body: input.body.trim(),
        client_id: clientId,
        created_at: new Date().toISOString(),
        expires_at: null,
        reply_to: replyTo
          ? {
              id: replyTo.id,
              sender_id: replyTo.sender_id,
              kind: replyTo.kind,
              body: replyTo.body,
              attachment: replyTo.attachment,
            }
          : null,
        attachment: file
          ? {
              id: "local",
              url: URL.createObjectURL(file),
              file_name: file.name,
              content_type: file.type || "application/octet-stream",
              size_bytes: file.size,
            }
          : null,
        reactions: [],
        status: "sending",
      };
      pendingSends.set(clientId, { conversationId, input });
      applyMessage(optimistic, false);
      set((s) => ({ replyTo: { ...s.replyTo, [conversationId]: null }, drafts: { ...s.drafts, [conversationId]: "" } }));
      await deliver(conversationId, clientId, input);
    },

    retryMessage: (conversationId, clientId) => {
      const pending = pendingSends.get(clientId);
      if (!pending) return;
      patchTimeline(conversationId, (t) => ({
        items: t.items.map((m) => (m.client_id === clientId ? { ...m, status: "sending" } : m)),
      }));
      // Same client_id: the server de-duplicates if the first attempt actually went through.
      void deliver(conversationId, clientId, pending.input);
    },

    receiveMessage: (message) => {
      if (!get().conversations[message.conversation_id]) {
        void get().refreshConversation(message.conversation_id);
        return;
      }
      const incoming = message.sender_id !== meId();
      const viewing = isViewing(message.conversation_id);
      applyMessage(message, incoming && message.kind === "text" && !viewing);
      if (incoming && message.sender_id !== null) get().setTyping(message.conversation_id, message.sender_id, false);
      if (incoming && viewing) get().markRead(message.conversation_id);
    },

    applyStatusUpdates: (updates) => {
      const byConversation = new Map<number, Map<number, MessageStatus>>();
      for (const u of updates) {
        if (!byConversation.has(u.conversation_id)) byConversation.set(u.conversation_id, new Map());
        byConversation.get(u.conversation_id)!.set(u.message_id, u.status);
      }
      byConversation.forEach((statuses, conversationId) => {
        const update = (m: Message) => {
          const status = statuses.get(m.id);
          return status ? { ...m, status: mergeStatus(m.status, status) } : m;
        };
        patchTimeline(conversationId, (t) => ({ items: t.items.map(update) }));
        patchConversation(conversationId, (c) => ({ last_message: c.last_message && update(c.last_message) }));
      });
    },

    setReactions: (conversationId, messageId, reactions) => {
      const update = (m: Message) => (m.id === messageId ? { ...m, reactions } : m);
      patchTimeline(conversationId, (t) => ({ items: t.items.map(update) }));
    },

    removeMessages: (conversationId, messageIds) => {
      const gone = new Set(messageIds);
      patchTimeline(conversationId, (t) => ({ items: t.items.filter((m) => !gone.has(m.id)) }));
      const last = get().conversations[conversationId]?.last_message;
      if (last && gone.has(last.id)) void get().refreshConversation(conversationId);
    },

    markRead: (conversationId) => {
      get().clearUnread(conversationId);
      api.conversations.markRead(conversationId).catch(() => {});
    },

    clearUnread: (conversationId) => patchConversation(conversationId, () => ({ unread_count: 0 })),

    setTyping: (conversationId, userId, isTyping) => {
      const key = `${conversationId}:${userId}`;
      clearTimeout(typingTimers.get(key));
      typingTimers.delete(key);
      set((s) => {
        const current = s.typing[conversationId] ?? [];
        const next = isTyping
          ? current.includes(userId)
            ? current
            : [...current, userId]
          : current.filter((id) => id !== userId);
        return { typing: { ...s.typing, [conversationId]: next } };
      });
      // Clear stale indicators if the "stopped typing" event never arrives (e.g. sender closed the tab).
      if (isTyping) {
        typingTimers.set(key, setTimeout(() => get().setTyping(conversationId, userId, false), TYPING_TIMEOUT_MS));
      }
    },

    setDraft: (conversationId, text) => set((s) => ({ drafts: { ...s.drafts, [conversationId]: text } })),
    setReplyTo: (conversationId, message) => set((s) => ({ replyTo: { ...s.replyTo, [conversationId]: message } })),

    openDirect: async (userId) => {
      const dto = await api.conversations.openDirect(userId);
      get().upsertConversation(dto);
      get().setActive(dto.id);
      return dto.id;
    },

    createGroup: async (title, memberIds) => {
      const dto = await api.conversations.createGroup(title, memberIds);
      get().upsertConversation(dto);
      get().setActive(dto.id);
      return dto.id;
    },
  };
});
