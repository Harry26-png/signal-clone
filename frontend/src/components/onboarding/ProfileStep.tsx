"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/common/Button";
import { AvatarPicker } from "@/components/profile/AvatarPicker";
import { api, ApiError } from "@/lib/api";
import { useSessionStore } from "@/store/session";
import styles from "./onboarding.module.css";

export function ProfileStep() {
  const finishOnboarding = useSessionStore((s) => s.finishOnboarding);
  const signOut = useSessionStore((s) => s.signOut);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!firstName.trim()) return;
    setBusy(true);
    try {
      finishOnboarding(await api.users.updateMe({ display_name: displayName }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save your profile");
      setBusy(false);
    }
  };

  return (
    <main className={styles.screen}>
      <form className={styles.card} onSubmit={onSubmit}>
        <h1 className={styles.title}>Your profile</h1>
        <p className={styles.subtitle}>
          Profiles are only visible to people you message, contacts, and groups.
        </p>
        <AvatarPicker previewName={displayName} />
        <input
          className={styles.field}
          placeholder="First name (required)"
          value={firstName}
          maxLength={32}
          onChange={(e) => setFirstName(e.target.value)}
          autoFocus
          aria-label="First name"
        />
        <input
          className={styles.field}
          placeholder="Last name (optional)"
          value={lastName}
          maxLength={31}
          onChange={(e) => setLastName(e.target.value)}
          aria-label="Last name"
        />
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions} style={{ justifyContent: "space-between" }}>
          <Button variant="ghost" type="button" onClick={() => void signOut()}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !firstName.trim()}>
            Next
          </Button>
        </div>
      </form>
    </main>
  );
}
