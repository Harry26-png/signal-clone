"use client";

import { type ClipboardEvent, type KeyboardEvent, useRef, useState } from "react";
import { Button, IconButton } from "@/components/common/Button";
import { BackIcon } from "@/components/common/icons";
import { api, ApiError } from "@/lib/api";
import { formatPhone } from "@/lib/format";
import { useSessionStore } from "@/store/session";
import styles from "./onboarding.module.css";

const LENGTH = 6;

export function OtpStep({ phone, onBack }: { phone: string; onBack: () => void }) {
  const signIn = useSessionStore((s) => s.signIn);
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const verify = async (code: string) => {
    setBusy(true);
    setError("");
    try {
      signIn(await api.auth.verify(phone, code));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Verification failed");
      setDigits(Array(LENGTH).fill(""));
      inputs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  const update = (next: string[]) => {
    setDigits(next);
    if (next.every(Boolean)) void verify(next.join(""));
  };

  const onChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = digits.slice();
    next[index] = digit;
    if (digit && index < LENGTH - 1) inputs.current[index + 1]?.focus();
    update(next);
  };

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) inputs.current[index - 1]?.focus();
  };

  const onPaste = (event: ClipboardEvent) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (pasted.length === LENGTH) {
      event.preventDefault();
      update(pasted.split(""));
    }
  };

  return (
    <main className={styles.screen}>
      <div className={styles.card}>
        <IconButton label="Back" className={styles.back} onClick={onBack}>
          <BackIcon />
        </IconButton>
        <h1 className={styles.title}>Verification code</h1>
        <p className={styles.subtitle}>Enter the code we sent to {formatPhone(phone)}</p>
        <div className={styles.codeRow} onPaste={onPaste}>
          {digits.map((digit, i) => (
            <span key={i} style={{ display: "contents" }}>
              {i === LENGTH / 2 && <span className={styles.codeDash}>–</span>}
              <input
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                className={styles.codeBox}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={digit}
                disabled={busy}
                autoFocus={i === 0}
                aria-label={`Digit ${i + 1}`}
                onChange={(e) => onChange(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
              />
            </span>
          ))}
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.hint}>Phone verification is simulated. Use the code <b>123456</b>.</div>
        <div className={styles.actions}>
          <Button variant="ghost" type="button" onClick={() => update("123456".split(""))} disabled={busy}>
            Autofill demo code
          </Button>
        </div>
      </div>
    </main>
  );
}
