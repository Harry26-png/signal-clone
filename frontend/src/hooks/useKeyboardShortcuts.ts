"use client";

import { useEffect } from "react";
import { useChatStore } from "@/store/chat";
import { useUIStore } from "@/store/ui";

export const SHORTCUTS: { keys: string[]; description: string }[] = [
  { keys: ["Ctrl", "N"], description: "Start a new chat" },
  { keys: ["Ctrl", "Shift", "G"], description: "Create a new group" },
  { keys: ["Ctrl", "F"], description: "Search chats" },
  { keys: ["Alt", "↑"], description: "Previous chat" },
  { keys: ["Alt", "↓"], description: "Next chat" },
  { keys: ["Ctrl", ","], description: "Open settings" },
  { keys: ["Ctrl", "/"], description: "Show keyboard shortcuts" },
  { keys: ["Esc"], description: "Close panel, reply, or dialog" },
  { keys: ["Enter"], description: "Send message" },
  { keys: ["Shift", "Enter"], description: "New line in message" },
];

/** Chats in the order the sidebar shows them (most recent activity first). */
function orderedConversationIds(): number[] {
  return Object.values(useChatStore.getState().conversations)
    .sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at))
    .map((c) => c.id);
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const ui = useUIStore.getState();
      const chat = useChatStore.getState();
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (mod && !event.shiftKey && key === "n") {
        event.preventDefault();
        ui.setLeftView({ name: "compose" });
      } else if (mod && event.shiftKey && key === "g") {
        event.preventDefault();
        ui.setLeftView({ name: "newGroup" });
      } else if (mod && key === "f") {
        event.preventDefault();
        ui.focusSearch();
      } else if (mod && key === ",") {
        event.preventDefault();
        ui.setTab("settings");
      } else if (mod && key === "/") {
        event.preventDefault();
        ui.openModal({ type: "shortcuts" });
      } else if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        const ids = orderedConversationIds();
        if (ids.length === 0) return;
        const index = chat.activeId === null ? -1 : ids.indexOf(chat.activeId);
        const next = event.key === "ArrowUp" ? Math.max(0, index - 1) : Math.min(ids.length - 1, index + 1);
        ui.setTab("chats");
        chat.setActive(ids[next]);
      } else if (event.key === "Escape") {
        if (ui.modal) ui.closeModal();
        else if (ui.showDetails) ui.setShowDetails(false);
        else if (chat.activeId !== null && chat.replyTo[chat.activeId]) chat.setReplyTo(chat.activeId, null);
        else if (ui.leftView.name !== "list") ui.setLeftView({ name: "list" });
        else return;
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
