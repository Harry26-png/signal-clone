// Mirrors backend/app/schemas.py.

export type Role = "admin" | "member";

/** Server statuses plus client-only states for optimistic sends. */
export type MessageStatus = "sending" | "failed" | "sent" | "delivered" | "read";

export interface User {
  id: number;
  phone: string;
  username: string | null;
  display_name: string;
  about: string;
  avatar_color: string;
  avatar_url: string | null;
  online: boolean;
  last_seen_at: string;
}

export interface Attachment {
  id: string;
  url: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
}

export interface Reaction {
  user_id: number;
  emoji: string;
}

export interface ReplyPreview {
  id: number;
  sender_id: number | null;
  kind: "text" | "system";
  body: string;
  attachment: Attachment | null;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number | null;
  kind: "text" | "system";
  body: string;
  client_id: string | null;
  created_at: string;
  expires_at: string | null;
  reply_to: ReplyPreview | null;
  attachment: Attachment | null;
  reactions: Reaction[];
  status: MessageStatus;
}

export interface MessagePage {
  messages: Message[];
  has_more: boolean;
}

export interface MemberDTO {
  user: User;
  role: Role;
  joined_at: string;
}

export interface ConversationDTO {
  id: number;
  kind: "direct" | "group";
  title: string | null;
  description: string;
  avatar_color: string;
  disappearing_seconds: number;
  created_at: string;
  last_activity_at: string;
  members: MemberDTO[];
  my_role: Role;
  unread_count: number;
  last_message: Message | null;
}

/** Normalized in the store: member users live in the shared `users` map. */
export interface Member {
  user_id: number;
  role: Role;
  joined_at: string;
}

export interface Conversation extends Omit<ConversationDTO, "members"> {
  members: Member[];
}

export interface AuthResponse {
  token: string;
  user: User;
  is_new_user: boolean;
}

export interface StatusUpdate {
  message_id: number;
  conversation_id: number;
  status: MessageStatus;
}

export type ServerEvent =
  | { type: "message.new"; message: Message }
  | { type: "message.status"; updates: StatusUpdate[] }
  | { type: "message.reactions"; conversation_id: number; message_id: number; reactions: Reaction[] }
  | { type: "message.deleted"; conversation_id: number; message_ids: number[] }
  | { type: "conversation.updated"; conversation_id: number }
  | { type: "conversation.removed"; conversation_id: number }
  | { type: "conversation.read"; conversation_id: number }
  | { type: "typing"; conversation_id: number; user_id: number; is_typing: boolean }
  | { type: "presence"; user_id: number; online: boolean; last_seen_at: string }
  | { type: "user.updated"; user: User }
  | { type: "pong" }
  | { type: "error"; detail: string };

export type ClientEvent =
  | { type: "typing"; conversation_id: number; is_typing: boolean }
  | { type: "delivered"; message_ids: number[] }
  | { type: "ping" };
