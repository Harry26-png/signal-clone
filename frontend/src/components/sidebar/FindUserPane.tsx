"use client";

import { type FormEvent, useState } from "react";
import { UserAvatar } from "@/components/common/Avatar";
import { Button } from "@/components/common/Button";
import { api, ApiError } from "@/lib/api";
import { formatPhone } from "@/lib/format";
import type { User } from "@/lib/types";
import { useChatStore } from "@/store/chat";
import { toast, useUIStore } from "@/store/ui";
import { PaneHeader } from "./PaneHeader";
import styles from "./sidebar.module.css";

/** Look a user up by exact phone number or username, then message them and/or save them as a contact. */
export function FindUserPane({ mode }: { mode: "phone" | "username" }) {
  const setLeftView = useUIStore((s) => s.setLeftView);
  const contactIds = useChatStore((s) => s.contactIds);
  const isContact = (id: number) => contactIds.includes(id);
  const [query, setQuery] = useState(mode === "phone" ? "+1" : "");
  const [result, setResult] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await api.users.lookup(query.trim()));
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 404
          ? mode === "phone"
            ? `${query.trim()} is not a Signal user`
            : `Username “${query.trim()}” not found`
          : e instanceof ApiError
            ? e.message
            : "Lookup failed",
      );
    } finally {
      setBusy(false);
    }
  };

  const addContact = async (user: User) => {
    try {
      useChatStore.getState().addContact(await api.contacts.add(user.id));
      toast(`${user.display_name} added to your contacts`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't add contact");
    }
  };

  const message = async (user: User) => {
    await useChatStore.getState().openDirect(user.id);
    setLeftView({ name: "list" });
  };

  return (
    <div className={styles.pane}>
      <PaneHeader
        title={mode === "phone" ? "Find by phone number" : "Find by username"}
        onBack={() => setLeftView({ name: "compose" })}
      />
      <form className={styles.findForm} onSubmit={search}>
        <input
          className={styles.textField}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={mode === "phone" ? "Phone number with country code" : "Username, e.g. bob.42"}
          inputMode={mode === "phone" ? "tel" : "text"}
          autoFocus
          aria-label={mode === "phone" ? "Phone number" : "Username"}
        />
        <p className={styles.findHint}>
          {mode === "phone"
            ? "Enter the full number including the country code, e.g. +1 555 010 0008."
            : "Usernames are always paired with a set of numbers."}
        </p>
        {error && <p className={styles.error}>{error}</p>}
        <Button type="submit" disabled={busy || query.trim().length < 3}>
          Next
        </Button>
      </form>

      {result && (
        <div className={styles.resultCard}>
          <UserAvatar user={result} size={64} />
          <span className={styles.resultName}>{result.display_name}</span>
          <span className={styles.contactSub}>
            {formatPhone(result.phone)}
            {result.username ? ` · @${result.username}` : ""}
          </span>
          <div className={styles.resultActions}>
            <Button onClick={() => void message(result)}>Message</Button>
            {isContact(result.id) ? (
              <Button variant="secondary" disabled>
                In contacts
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => void addContact(result)}>
                Add to contacts
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
