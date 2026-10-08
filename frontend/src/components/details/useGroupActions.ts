"use client";

import { useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import type { Conversation } from "@/lib/types";
import { useChatStore } from "@/store/chat";
import { useMeId } from "@/store/session";
import { toast, useUIStore } from "@/store/ui";

/** Run an API action and surface failures as a toast. */
export async function withToast(action: () => Promise<unknown>, success?: string) {
  try {
    await action();
    if (success) toast(success);
  } catch (e) {
    toast(e instanceof ApiError ? e.message : "Something went wrong");
  }
}

export function useLeaveGroup(conversation: Conversation | undefined) {
  const meId = useMeId();
  const openModal = useUIStore((s) => s.openModal);
  const id = conversation?.id;
  const title = conversation?.title;
  return useCallback(() => {
    if (id === undefined) return;
    openModal({
      type: "confirm",
      title: "Leave group?",
      body: `You will no longer be able to send or receive messages in “${title}”.`,
      confirmLabel: "Leave",
      danger: true,
      onConfirm: () =>
        withToast(async () => {
          await api.conversations.removeMember(id, meId);
          useChatStore.getState().removeConversation(id);
        }, `You left “${title}”`),
    });
  }, [id, title, meId, openModal]);
}
