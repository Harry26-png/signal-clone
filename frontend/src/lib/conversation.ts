import { formatDuration } from "./format";
import type { Conversation, Message, User } from "./types";

export type UserMap = Record<number, User>;

export function otherMember(conversation: Conversation, meId: number, users: UserMap): User | undefined {
  const other = conversation.members.find((m) => m.user_id !== meId);
  return other ? users[other.user_id] : undefined;
}

export function displayName(user: User | undefined): string {
  return user?.display_name || "Unknown";
}

export function conversationTitle(conversation: Conversation, meId: number, users: UserMap): string {
  if (conversation.kind === "group") return conversation.title || "Group";
  return displayName(otherMember(conversation, meId, users));
}

/** Short label for attachments in previews and quotes. */
export function attachmentLabel(contentType: string): string {
  if (contentType.startsWith("image/")) return "📷 Photo";
  if (contentType.startsWith("video/")) return "🎥 Video";
  if (contentType.startsWith("audio/")) return "🎤 Audio";
  return "📎 File";
}

interface SystemPayload {
  event: string;
  user_id?: number;
  user_ids?: number[];
  title?: string;
  seconds?: number;
  role?: string;
}

/** Render a system timeline event from the viewer's perspective ("You added Bob."). */
export function describeSystemMessage(message: Pick<Message, "body" | "sender_id">, meId: number, users: UserMap): string {
  let payload: SystemPayload;
  try {
    payload = JSON.parse(message.body);
  } catch {
    return message.body;
  }
  const name = (id: number | null | undefined, capital = false) =>
    id === meId ? (capital ? "You" : "you") : displayName(id != null ? users[id] : undefined);
  const actor = name(message.sender_id, true);

  switch (payload.event) {
    case "group_created":
      return `${actor} created the group.`;
    case "members_added":
      return `${actor} added ${(payload.user_ids ?? []).map((id) => name(id)).join(", ")}.`;
    case "member_removed":
      return `${actor} removed ${name(payload.user_id)}.`;
    case "member_left":
      return `${name(payload.user_id, true)} left the group.`;
    case "title_changed":
      return `${actor} changed the group name to “${payload.title}”.`;
    case "timer_changed":
      return payload.seconds
        ? `${actor} set the disappearing message timer to ${formatDuration(payload.seconds)}.`
        : `${actor} disabled disappearing messages.`;
    case "role_changed":
      return payload.role === "admin"
        ? `${actor} made ${name(payload.user_id)} an admin.`
        : `${actor} revoked admin privileges from ${name(payload.user_id)}.`;
    default:
      return "Group updated.";
  }
}

export function messagePreview(message: Message, meId: number, users: UserMap): string {
  if (message.kind === "system") return describeSystemMessage(message, meId, users);
  if (message.body) return message.body;
  return message.attachment ? attachmentLabel(message.attachment.content_type) : "";
}

export function newClientId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Deterministic, fake "safety number" (Signal shows 60 digits in 12 groups). Encryption is simulated. */
export function mockSafetyNumber(a: User, b: User): string[] {
  const seed = [a.phone, b.phone].sort().join("|");
  let hash = 2166136261;
  const digits: string[] = [];
  for (let i = 0; digits.length < 60; i++) {
    hash ^= seed.charCodeAt(i % seed.length) + i;
    hash = Math.imul(hash, 16777619) >>> 0;
    digits.push(String(hash % 10));
  }
  return Array.from({ length: 12 }, (_, i) => digits.slice(i * 5, i * 5 + 5).join(""));
}
