import { assetUrl } from "@/lib/api";
import { avatarColors, initials } from "@/lib/avatar";
import type { Conversation, User } from "@/lib/types";
import styles from "./common.module.css";
import { GroupIcon, PersonIcon } from "./icons";

interface AvatarProps {
  size?: number;
  name: string;
  color: string;
  imageUrl?: string | null;
  isGroup?: boolean;
  online?: boolean;
}

export function Avatar({ size = 48, name, color, imageUrl, isGroup, online }: AvatarProps) {
  const { bg, fg } = avatarColors(color);
  const text = initials(name);
  const src = assetUrl(imageUrl);
  return (
    <span className={styles.avatar} style={{ width: size, height: size }}>
      <span
        className={styles.avatarInner}
        style={{ background: bg, color: fg, fontSize: Math.round(size * 0.4) }}
      >
        {src ? (
          <img src={src} alt="" />
        ) : isGroup ? (
          <GroupIcon size={Math.round(size * 0.55)} />
        ) : text ? (
          text
        ) : (
          <PersonIcon size={Math.round(size * 0.55)} />
        )}
      </span>
      {online && <span className={styles.presence} aria-label="Online" />}
    </span>
  );
}

export function UserAvatar({ user, size, showPresence }: { user?: User; size?: number; showPresence?: boolean }) {
  return (
    <Avatar
      size={size}
      name={user?.display_name ?? ""}
      color={user?.avatar_color ?? "A200"}
      imageUrl={user?.avatar_url}
      online={showPresence && user?.online}
    />
  );
}

export function ConversationAvatar({
  conversation,
  other,
  size,
  showPresence,
}: {
  conversation: Conversation;
  other?: User;
  size?: number;
  showPresence?: boolean;
}) {
  if (conversation.kind === "group") {
    return <Avatar size={size} name={conversation.title ?? ""} color={conversation.avatar_color} isGroup />;
  }
  return <UserAvatar user={other} size={size} showPresence={showPresence} />;
}
