import type { ReactNode } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { PaneHeader } from "./PaneHeader";
import styles from "./sidebar.module.css";

/** Left pane for tabs that are placeholders in this clone (Calls, Stories). */
export function PlaceholderPane({ title, icon, feature }: { title: string; icon: ReactNode; feature: string }) {
  return (
    <div className={styles.pane}>
      <PaneHeader title={title} />
      <EmptyState icon={icon} badge="Coming soon" title={`No ${title.toLowerCase()} yet`} text={`${feature} are coming soon.`} />
    </div>
  );
}
