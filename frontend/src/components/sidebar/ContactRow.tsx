import type { ReactNode } from "react";
import { UserAvatar } from "@/components/common/Avatar";
import { CheckIcon } from "@/components/common/icons";
import { formatPhone } from "@/lib/format";
import type { User } from "@/lib/types";
import styles from "./sidebar.module.css";

export function ContactRow({
  user,
  onClick,
  checked,
  subtitle,
  trailing,
}: {
  user: User;
  onClick: () => void;
  /** Renders a selection checkbox when defined. */
  checked?: boolean;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  return (
    <button className={styles.contactRow} onClick={onClick} role={checked === undefined ? undefined : "checkbox"} aria-checked={checked}>
      <UserAvatar user={user} size={36} />
      <span className={styles.rowBody}>
        <span className={styles.rowName}>{user.display_name}</span>
        <span className={styles.contactSub}>{subtitle ?? (user.about || formatPhone(user.phone))}</span>
      </span>
      {trailing}
      {checked !== undefined && (
        <span className={styles.checkbox} data-checked={checked}>
          {checked && <CheckIcon size={14} strokeWidth={2.5} />}
        </span>
      )}
    </button>
  );
}

export function ActionRow({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button className={styles.contactRow} onClick={onClick}>
      <span className={styles.actionIcon}>{icon}</span>
      <span className={styles.rowName}>{label}</span>
    </button>
  );
}
