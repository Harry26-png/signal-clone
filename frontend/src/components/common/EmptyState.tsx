import type { ReactNode } from "react";
import styles from "./common.module.css";

export function EmptyState({
  icon,
  title,
  text,
  badge,
  children,
}: {
  icon?: ReactNode;
  title: string;
  text?: string;
  badge?: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.emptyState}>
      {icon && <div className={styles.emptyIcon}>{icon}</div>}
      {badge && <span className={styles.badge}>{badge}</span>}
      <h2 className={styles.emptyTitle}>{title}</h2>
      {text && <p className={styles.emptyText}>{text}</p>}
      {children}
    </div>
  );
}
