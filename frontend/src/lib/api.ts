import type {
  Attachment,
  AuthResponse,
  ConversationDTO,
  Message,
  MessagePage,
  Role,
  User,
} from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
export const WS_URL = API_URL.replace(/^http/, "ws") + "/ws";

const TOKEN_KEY = "signal-clone.token";

export const tokenStorage = {
  get: (): string | null => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

let onUnauthorized: () => void = () => {};
/** Registered by the session store so an expired token logs the user out everywhere. */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

/** Resolve server-relative upload paths ("/uploads/...") against the API origin. */
export function assetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return /^(https?:|blob:|data:)/.test(path) ? path : `${API_URL}${path}`;
}

type Body = Record<string, unknown> | FormData;

async function request<T>(method: string, path: string, body?: Body): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenStorage.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method,
      headers,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }

  if (response.status === 401 && token) onUnauthorized();
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const data = await response.json();
      detail = typeof data.detail === "string" ? data.detail : (data.detail?.[0]?.msg ?? detail);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(response.status, detail);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

const get = <T>(path: string) => request<T>("GET", path);
const post = <T>(path: string, body?: Body) => request<T>("POST", path, body);
const patch = <T>(path: string, body: Body) => request<T>("PATCH", path, body);
const put = <T>(path: string, body: Body) => request<T>("PUT", path, body);
const del = <T>(path: string) => request<T>("DELETE", path);

export const api = {
  auth: {
    requestOtp: (phone: string) => post<{ is_registered: boolean; hint: string }>("/auth/otp", { phone }),
    verify: (phone: string, code: string) => post<AuthResponse>("/auth/verify", { phone, code }),
    logout: () => post<void>("/auth/logout"),
  },
  users: {
    me: () => get<User>("/users/me"),
    updateMe: (data: Partial<Pick<User, "display_name" | "about" | "username" | "avatar_color">>) =>
      patch<User>("/users/me", data),
    setAvatar: (attachmentId: string | null) => put<User>("/users/me/avatar", { attachment_id: attachmentId }),
    lookup: (q: string) => get<User>(`/users/lookup?q=${encodeURIComponent(q)}`),
  },
  contacts: {
    list: () => get<User[]>("/contacts"),
    add: (userId: number) => post<User>("/contacts", { user_id: userId }),
    remove: (userId: number) => del<void>(`/contacts/${userId}`),
  },
  conversations: {
    list: () => get<ConversationDTO[]>("/conversations"),
    get: (id: number) => get<ConversationDTO>(`/conversations/${id}`),
    openDirect: (userId: number) => post<ConversationDTO>("/conversations/direct", { user_id: userId }),
    createGroup: (title: string, memberIds: number[]) =>
      post<ConversationDTO>("/conversations/groups", { title, member_ids: memberIds }),
    update: (id: number, data: { title?: string; description?: string; disappearing_seconds?: number }) =>
      patch<ConversationDTO>(`/conversations/${id}`, data),
    addMembers: (id: number, userIds: number[]) =>
      post<ConversationDTO>(`/conversations/${id}/members`, { user_ids: userIds }),
    setRole: (id: number, userId: number, role: Role) =>
      patch<ConversationDTO>(`/conversations/${id}/members/${userId}`, { role }),
    removeMember: (id: number, userId: number) => del<void>(`/conversations/${id}/members/${userId}`),
    markRead: (id: number) => post<void>(`/conversations/${id}/read`),
  },
  messages: {
    list: (conversationId: number, beforeId?: number) =>
      get<MessagePage>(
        `/conversations/${conversationId}/messages?limit=50${beforeId ? `&before_id=${beforeId}` : ""}`,
      ),
    send: (
      conversationId: number,
      data: { body: string; client_id: string; reply_to_id?: number | null; attachment_id?: string | null },
    ) => post<Message>(`/conversations/${conversationId}/messages`, data),
    react: (messageId: number, emoji: string) => put<void>(`/messages/${messageId}/reaction`, { emoji }),
    unreact: (messageId: number) => del<void>(`/messages/${messageId}/reaction`),
  },
  attachments: {
    upload: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return post<Attachment>("/attachments", form);
    },
  },
};
