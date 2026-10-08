"use client";

import { useMemo } from "react";
import type { Conversation, User } from "@/lib/types";
import { useChatStore } from "@/store/chat";

// Zustand v5 requires selectors to return stable references, so derived arrays are memoised here
// from the (stable) underlying state slices rather than built inside the selector.

const byName = (a: User, b: User) => a.display_name.localeCompare(b.display_name);

export function useContacts(): User[] {
  const ids = useChatStore((s) => s.contactIds);
  const users = useChatStore((s) => s.users);
  return useMemo(() => ids.map((id) => users[id]).filter(Boolean).sort(byName), [ids, users]);
}

/** Conversations ordered by most recent activity (the sidebar order). */
export function useSortedConversations(): Conversation[] {
  const conversations = useChatStore((s) => s.conversations);
  return useMemo(
    () => Object.values(conversations).sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at)),
    [conversations],
  );
}

export function useConversation(id: number): Conversation | undefined {
  return useChatStore((s) => s.conversations[id]);
}
