import type { ReactNode } from "react";
import { IconButton } from "@/components/common/Button";
import { BackIcon } from "@/components/common/icons";
import styles from "./sidebar.module.css";

export function PaneHeader({
  title,
  onBack,
  actions,
}: {
  title: string;
  onBack?: () => void;
  actions?: ReactNode;
}) {
  return (
    <header className={`${styles.header} ${onBack ? styles.headerBack : ""}`}>
      {onBack && (
        <IconButton label="Back" onClick={onBack}>
          <BackIcon />
        </IconButton>
      )}
      <h1 className={styles.headerTitle}>{title}</h1>
      {actions}
    </header>
  );
}
