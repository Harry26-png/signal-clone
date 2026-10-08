"use client";

import { type FormEvent, useState } from "react";
import { Avatar, UserAvatar } from "@/components/common/Avatar";
import { ArrowRightIcon, CheckIcon, CloseIcon } from "@/components/common/icons";
import { useContacts } from "@/hooks/selectors";
import { ApiError } from "@/lib/api";
import { useChatStore } from "@/store/chat";
import { toast, useUIStore } from "@/store/ui";
import { ContactRow } from "./ContactRow";
import { PaneHeader } from "./PaneHeader";
import { SearchBox } from "./SearchBox";
import styles from "./sidebar.module.css";

/** Two steps, as in Signal: choose members, then name the group. */
export function NewGroupPane() {
  const setLeftView = useUIStore((s) => s.setLeftView);
  const contacts = useContacts();
  const createGroup = useChatStore((s) => s.createGroup);
  const [step, setStep] = useState<"members" | "name">("members");
  const [selected, setSelected] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = (id: number) =>
    setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const q = query.trim().toLowerCase();
  const visible = q ? contacts.filter((u) => u.display_name.toLowerCase().includes(q)) : contacts;
  const chosen = contacts.filter((u) => selected.includes(u.id));

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await createGroup(title.trim(), selected);
      setLeftView({ name: "list" });
      toast(`Group “${title.trim()}” created`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't create the group");
      setBusy(false);
    }
  };

  if (step === "name") {
    return (
      <form className={styles.pane} onSubmit={create}>
        <PaneHeader title="Name this group" onBack={() => setStep("members")} />
        <div className={styles.groupSetup}>
          <Avatar size={80} name={title} color="A130" isGroup />
          <input
            className={styles.textField}
            placeholder="Group name (required)"
            value={title}
            maxLength={64}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            aria-label="Group name"
          />
        </div>
        <div className={styles.list}>
          <h2 className={styles.sectionTitle}>Members</h2>
          {chosen.map((u) => (
            <ContactRow key={u.id} user={u} onClick={() => {}} />
          ))}
        </div>
        <button type="submit" className={styles.fab} disabled={busy || !title.trim()} aria-label="Create group">
          <CheckIcon size={22} strokeWidth={2.2} />
        </button>
      </form>
    );
  }

  return (
    <div className={styles.pane}>
      <PaneHeader title="Add members" onBack={() => setLeftView({ name: "compose" })} />
      <SearchBox value={query} onChange={setQuery} placeholder="Search contacts" autoFocus />
      {chosen.length > 0 && (
        <div className={styles.chips}>
          {chosen.map((u) => (
            <button key={u.id} className={styles.chip} onClick={() => toggle(u.id)} aria-label={`Remove ${u.display_name}`}>
              <UserAvatar user={u} size={24} />
              {u.display_name.split(" ")[0]}
              <CloseIcon size={12} />
            </button>
          ))}
        </div>
      )}
      <div className={styles.list}>
        {visible.map((u) => (
          <ContactRow key={u.id} user={u} checked={selected.includes(u.id)} onClick={() => toggle(u.id)} />
        ))}
        {visible.length === 0 && <p className={styles.emptyList}>No contacts found</p>}
      </div>
      <button className={styles.fab} disabled={selected.length === 0} onClick={() => setStep("name")} aria-label="Next">
        <ArrowRightIcon size={22} strokeWidth={2} />
      </button>
    </div>
  );
}
