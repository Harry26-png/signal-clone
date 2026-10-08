"use client";

import { ConversationAvatar } from "@/components/common/Avatar";
import { IconButton } from "@/components/common/Button";
import {
  BackIcon,
  InfoIcon,
  LeaveIcon,
  MoreIcon,
  PhoneIcon,
  ShieldIcon,
  TimerIcon,
  VideoIcon,
} from "@/components/common/icons";
import { Menu, type MenuItem } from "@/components/common/Menu";
import { useNow } from "@/hooks/useNow";
import { useLeaveGroup } from "@/components/details/useGroupActions";
import { conversationTitle, displayName, otherMember } from "@/lib/conversation";
import { formatDuration, formatLastSeen } from "@/lib/format";
import type { Conversation } from "@/lib/types";
import { useChatStore } from "@/store/chat";
import { useMeId } from "@/store/session";
import { comingSoon, useUIStore } from "@/store/ui";
import styles from "./chat.module.css";

function useSubtitle(conversation: Conversation): string {
  const meId = useMeId();
  const users = useChatStore((s) => s.users);
  const typingIds = useChatStore((s) => s.typing[conversation.id]);
  const now = useNow();

  if (conversation.kind === "group") {
    if (typingIds?.length) {
      const names = typingIds.map((id) => displayName(users[id]).split(" ")[0]);
      return names.length === 1 ? `${names[0]} is typing…` : `${names.join(", ")} are typing…`;
    }
    return `${conversation.members.length} member${conversation.members.length === 1 ? "" : "s"}`;
  }
  if (typingIds?.length) return "typing…";
  const other = otherMember(conversation, meId, users);
  if (!other) return "";
  return other.online ? "Online" : formatLastSeen(other.last_seen_at, now);
}

export function ChatHeader({ conversation }: { conversation: Conversation }) {
  const meId = useMeId();
  const users = useChatStore((s) => s.users);
  const setActive = useChatStore((s) => s.setActive);
  const setShowDetails = useUIStore((s) => s.setShowDetails);
  const openModal = useUIStore((s) => s.openModal);
  const leaveGroup = useLeaveGroup(conversation);
  const subtitle = useSubtitle(conversation);
  const isGroup = conversation.kind === "group";

  const menuItems: MenuItem[] = [
    {
      label: "Disappearing messages",
      icon: <TimerIcon size={18} />,
      onSelect: () => openModal({ type: "disappearing", conversationId: conversation.id }),
    },
    {
      label: isGroup ? "Group settings" : "Chat settings",
      icon: <InfoIcon size={18} />,
      onSelect: () => setShowDetails(true),
    },
  ];
  if (!isGroup) {
    menuItems.push({
      label: "View safety number",
      icon: <ShieldIcon size={18} />,
      onSelect: () => openModal({ type: "safetyNumber", conversationId: conversation.id }),
    });
  } else {
    menuItems.push({ label: "Leave group", icon: <LeaveIcon size={18} />, danger: true, onSelect: leaveGroup });
  }

  return (
    <header className={styles.header}>
      <IconButton label="Back" className={styles.mobileBack} onClick={() => setActive(null)}>
        <BackIcon />
      </IconButton>
      <button className={styles.headerInfo} onClick={() => setShowDetails(true)}>
        <ConversationAvatar
          conversation={conversation}
          other={otherMember(conversation, meId, users)}
          size={36}
          showPresence
        />
        <span className={styles.headerText}>
          <span className={styles.headerTitle}>
            {conversationTitle(conversation, meId, users)}
            {conversation.disappearing_seconds > 0 && (
              <span className={styles.headerTimer} title="Disappearing messages">
                <TimerIcon size={13} />
                {formatDuration(conversation.disappearing_seconds)}
              </span>
            )}
          </span>
          <span className={styles.headerSubtitle}>{subtitle}</span>
        </span>
      </button>
      <IconButton label="Video call" onClick={() => comingSoon("Video calls")}>
        <VideoIcon />
      </IconButton>
      <IconButton label="Voice call" onClick={() => comingSoon("Voice calls")}>
        <PhoneIcon />
      </IconButton>
      <Menu
        trigger={({ toggle }) => (
          <IconButton label="More options" onClick={toggle}>
            <MoreIcon />
          </IconButton>
        )}
        items={menuItems}
      />
    </header>
  );
}
