"use client";

import { type FormEvent, useState } from "react";
import { Avatar } from "@/components/common/Avatar";
import { Button } from "@/components/common/Button";
import { api, ApiError } from "@/lib/api";
import styles from "./onboarding.module.css";

// Plain ISO codes: Windows does not render flag emoji.
const COUNTRIES = [
  { code: "+1", label: "US +1" },
  { code: "+44", label: "GB +44" },
  { code: "+91", label: "IN +91" },
  { code: "+49", label: "DE +49" },
  { code: "+33", label: "FR +33" },
  { code: "+61", label: "AU +61" },
  { code: "+81", label: "JP +81" },
];

/** Seeded accounts (backend/app/seed.py) so reviewers can sign in with one click. */
const DEMO_ACCOUNTS = [
  { name: "Alice Johnson", number: "5550100001", color: "A110" },
  { name: "Bob Martinez", number: "5550100002", color: "A130" },
  { name: "Carol Nguyen", number: "5550100003", color: "A150" },
  { name: "David Kim", number: "5550100004", color: "A120" },
];

export function PhoneStep({ onSubmitted }: { onSubmitted: (phone: string) => void }) {
  const [country, setCountry] = useState("+1");
  const [number, setNumber] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (fullNumber: string) => {
    setBusy(true);
    setError("");
    try {
      await api.auth.requestOtp(fullNumber);
      onSubmitted(fullNumber);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const digits = number.replace(/\D/g, "");
    if (digits.length < 6) {
      setError("Enter a valid phone number");
      return;
    }
    void submit(`${country}${digits}`);
  };

  return (
    <main className={styles.screen}>
      <form className={styles.card} onSubmit={onSubmit}>
        <img className={styles.logo} src="/icon.svg" alt="" />
        <h1 className={styles.title}>Phone number</h1>
        <p className={styles.subtitle}>Enter your phone number to get started.</p>
        <div className={styles.phoneRow}>
          <select
            className={styles.country}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            aria-label="Country code"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            className={styles.field}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="Phone number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            autoFocus
            aria-label="Phone number"
          />
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <Button type="submit" disabled={busy || !number.trim()}>
            Next
          </Button>
        </div>

        <section className={styles.demo}>
          <p className={styles.demoTitle}>Demo accounts (code 123456)</p>
          <div className={styles.demoList}>
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.number}
                type="button"
                className={styles.demoUser}
                onClick={() => {
                  setCountry("+1");
                  setNumber(a.number);
                  void submit(`+1${a.number}`);
                }}
              >
                <Avatar size={32} name={a.name} color={a.color} />
                <span>
                  {a.name}
                  <small>+1 {a.number.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      </form>
    </main>
  );
}
