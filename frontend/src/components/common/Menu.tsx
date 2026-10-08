"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import styles from "./menu.module.css";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  onSelect: () => void;
}

interface MenuProps {
  /** Renders the trigger; call `toggle` from its onClick. */
  trigger: (props: { toggle: () => void; open: boolean }) => ReactNode;
  items: MenuItem[];
  align?: "left" | "right";
  placement?: "below" | "above";
}

export function Menu({ trigger, items, align = "right", placement = "below" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close, true);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={root}>
      {trigger({ toggle: () => setOpen((o) => !o), open })}
      {open && (
        <div className={`${styles.menu} ${styles[align]} ${styles[placement]}`} role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              className={`${styles.item} ${item.danger ? styles.danger : ""}`}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
