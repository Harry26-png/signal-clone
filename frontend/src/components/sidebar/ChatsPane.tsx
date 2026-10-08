"use client";

import { useUIStore } from "@/store/ui";
import { ComposePane } from "./ComposePane";
import { ConversationListPane } from "./ConversationListPane";
import { FindUserPane } from "./FindUserPane";
import { NewGroupPane } from "./NewGroupPane";

/** The Chats tab's left pane, which Signal swaps between the list and the compose flows. */
export function ChatsPane() {
  const view = useUIStore((s) => s.leftView);
  switch (view.name) {
    case "compose":
      return <ComposePane />;
    case "newGroup":
      return <NewGroupPane />;
    case "find":
      return <FindUserPane key={view.mode} mode={view.mode} />;
    default:
      return <ConversationListPane />;
  }
}
