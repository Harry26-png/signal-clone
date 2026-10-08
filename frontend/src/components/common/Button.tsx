import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./common.module.css";

type Variant = "primary" | "secondary" | "destructive" | "ghost";

export function Button({
  variant = "primary",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${styles.button} ${styles[variant]} ${className ?? ""}`} {...rest} />;
}

export function IconButton({
  label,
  active,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; children: ReactNode }) {
  return (
    <button
      className={`${styles.iconButton} ${active ? styles.active : ""} ${className ?? ""}`}
      aria-label={label}
      title={label}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={styles.toggle}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

export function Spinner() {
  return <div className={styles.spinner} role="status" aria-label="Loading" />;
}
