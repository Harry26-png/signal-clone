"use client";

import type { ReactNode } from "react";
import { ConversationAvatar, UserAvatar } from "@/components/common/Avatar";
import { IconButton } from "@/components/common/Button";
import {
  AddPersonIcon,
  BackIcon,
  EditIcon,
  LeaveIcon,
  MoreIcon,
  PhoneIcon,
  SearchIcon,
  ShieldIcon,
  TimerIcon,
  VideoIcon,
} from "@/components/common/icons";
import { Menu, type MenuItem } from "@/components/common/Menu";
import { useConversation } from "@/hooks/selectors";
import { useNow } from "@/hooks/useNow";
import { api } from "@/lib/api";
import { conversationTitle, displayName, otherMember } from "@/lib/conversation";
import { formatDuration, formatLastSeen, formatPhone } from "@/lib/format";
import type { Conversation, Member } from "@/lib/types";
import { useChatStore } from "@/store/chat";
import { useMeId } from "@/store/session";
import { comingSoon, useUIStore } from "@/store/ui";
import styles from "./details.module.css";
import { useLeaveGroup, withToast } from "./useGroupActions";

function Item({
  icon,
  label,
  value,
  onClick,
  danger,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const content = (
    <>
      <span className={styles.itemIcon}>{icon}</span>
      <span className={styles.itemBody}>
        <span className={styles.itemLabel}>{label}</span>
        {value && <span className={styles.itemValue}>{value}</span>}
      </span>
    </>
  );
  return onClick ? (
    <button className={`${styles.item} ${danger ? styles.danger : ""}`} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className={styles.item}>{content}</div>
  );
}

function MemberRow({ conversation, member }: { conversation: Conversation; member: Member }) {
  const meId = useMeId();
  const user = useChatStore((s) => s.users[member.user_id]);
  const openModal = useUIStore((s) => s.openModal);
  const isMe = member.user_id === meId;
  const iAmAdmin = conversation.my_role === "admin";
  const name = displayName(user);

  const items: MenuItem[] = [];
  if (!isMe) {
    items.push({
      label: "Message",
      onSelect: () => void useChatStore.getState().openDirect(member.user_id),
    });
  }
  if (iAmAdmin && !isMe) {
    items.push(
      member.role === "admin"
        ? {
            label: "Remove as admin",
            onSelect: () =>
              void withToast(
                () => api.conversations.setRole(conversation.id, member.user_id, "member"),
                `${name} is no longer an admin`,
              ),
          }
        : {
            label: "Make admin",
            onSelect: () =>
              void withToast(
                () => api.conversations.setRole(conversation.id, member.user_id, "admin"),
                `${name} is now an admin`,
              ),
          },
      {
        label: "Remove from group",
        danger: true,
        onSelect: () =>
          openModal({
            type: "confirm",
            title: `Remove ${name}?`,
            body: `${name} will be removed from “${conversation.title}”.`,
            confirmLabel: "Remove",
            danger: true,
            onConfirm: () =>
              withToast(() => api.conversations.removeMember(conversation.id, member.user_id), `${name} removed`),
          }),
      },
    );
  }

  return (
    <div className={styles.item}>
      <UserAvatar user={user} size={36} showPresence />
      <span className={styles.itemBody}>
        <span className={styles.memberName}>{isMe ? "You" : name}</span>
        {user?.about && <span className={styles.itemValue}>{user.about}</span>}
      </span>
      {member.role === "admin" && <span className={styles.role}>Admin</span>}
      {items.length > 0 && (
        <Menu
          trigger={({ toggle }) => (
            <IconButton label={`Options for ${name}`} onClick={toggle}>
              <MoreIcon size={18} />
            </IconButton>
          )}
          items={items}
        />
      )}
    </div>
  );
}

export function ConversationDetails({ id }: { id: number }) {
  const meId = useMeId();
  const now = useNow();
  const conversation = useConversation(id);
  const users = useChatStore((s) => s.users);
  const setShowDetails = useUIStore((s) => s.setShowDetails);
  const openModal = useUIStore((s) => s.openModal);
  const leaveGroup = useLeaveGroup(conversation);
  if (!conversation) return null;

  const isGroup = conversation.kind === "group";
  const other = otherMember(conversation, meId, users);
  const isAdmin = conversation.my_role === "admin";
  // Admins first, then by join order, with "You" on top as Signal does.
  const members = [...conversation.members].sort(
    (a, b) =>
      Number(b.user_id === meId) - Number(a.user_id === meId) ||
      Number(b.role === "admin") - Number(a.role === "admin") ||
      a.joined_at.localeCompare(b.joined_at),
  );

  return (
    <section className={styles.pane} aria-label="Chat settings">
      <header className={styles.header}>
        <IconButton label="Back" onClick={() => setShowDetails(false)}>
          <BackIcon />
        </IconButton>
        <h1 className={styles.headerTitle}>{isGroup ? "Group settings" : "Chat settings"}</h1>
      </header>
      <div className={styles.scroll}>
        <div className={styles.content}>
          <div className={styles.profile}>
            <ConversationAvatar conversation={conversation} other={other} size={96} />
            <h2 className={styles.name}>
              {conversationTitle(conversation, meId, users)}
              {isGroup && (
                <IconButton label="Edit group" onClick={() => openModal({ type: "editGroup", conversationId: id })}>
                  <EditIcon size={16} />
                </IconButton>
              )}
            </h2>
            {isGroup ? (
              <>
                {conversation.description && <span className={styles.sub}>{conversation.description}</span>}
                <span className={styles.sub}>Group · {conversation.members.length} members</span>
              </>
            ) : (
              other && (
                <>
                  {other.about && <span className={styles.sub}>{other.about}</span>}
                  <span className={styles.sub}>{formatPhone(other.phone)}</span>
                  {other.username && <span className={styles.sub}>@{other.username}</span>}
                  <span className={styles.sub}>{other.online ? "Online" : formatLastSeen(other.last_seen_at, now)}</span>
                </>
              )
            )}
          </div>

          <div className={styles.quickActions}>
            <button className={styles.quickAction} onClick={() => comingSoon("Video calls")}>
              <VideoIcon /> Video
            </button>
            <button className={styles.quickAction} onClick={() => comingSoon("Voice calls")}>
              <PhoneIcon /> Audio
            </button>
            <button
              className={styles.quickAction}
              onClick={() => {
                setShowDetails(false);
                useUIStore.getState().focusSearch();
              }}
            >
              <SearchIcon /> Search
            </button>
          </div>

          <div className={styles.section}>
            <Item
              icon={<TimerIcon />}
              label="Disappearing messages"
              value={formatDuration(conversation.disappearing_seconds)}
              onClick={() => openModal({ type: "disappearing", conversationId: id })}
            />
            {!isGroup && (
              <Item
                icon={<ShieldIcon />}
                label="View safety number"
                onClick={() => openModal({ type: "safetyNumber", conversationId: id })}
              />
            )}
          </div>

          {isGroup && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>{conversation.members.length} members</h3>
              {isAdmin && (
                <button className={styles.item} onClick={() => openModal({ type: "addMembers", conversationId: id })}>
                  <span className={styles.addIcon}>
                    <AddPersonIcon size={18} />
                  </span>
                  <span className={styles.itemBody}>Add members</span>
                </button>
              )}
              {members.map((m) => (
                <MemberRow key={m.user_id} conversation={conversation} member={m} />
              ))}
            </div>
          )}

          {isGroup && (
            <div className={styles.section}>
              <Item icon={<LeaveIcon />} label="Leave group" danger onClick={leaveGroup} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
