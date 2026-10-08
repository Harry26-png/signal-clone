"use client";

import { type FormEvent, type ReactNode, useState } from "react";
import { Button, IconButton, Toggle } from "@/components/common/Button";
import commonStyles from "@/components/common/common.module.css";
import { EmptyState } from "@/components/common/EmptyState";
import { BackIcon, DevicesIcon } from "@/components/common/icons";
import { AvatarPicker } from "@/components/profile/AvatarPicker";
import { api, ApiError } from "@/lib/api";
import { formatPhone } from "@/lib/format";
import { useSessionStore } from "@/store/session";
import { type SettingsSection, type ThemePref, toast, useUIStore } from "@/store/ui";
import styles from "./settings.module.css";

const TITLES: Record<SettingsSection, string> = {
  profile: "Profile",
  general: "General",
  appearance: "Appearance",
  chats: "Chats",
  notifications: "Notifications",
  privacy: "Privacy",
  devices: "Linked devices",
};

function Group({ title, comingSoon, children }: { title: string; comingSoon?: boolean; children: ReactNode }) {
  return (
    <section className={styles.group}>
      <h2 className={styles.groupTitle}>
        {title}
        {comingSoon && <span className={commonStyles.badge}>Coming soon</span>}
      </h2>
      {children}
    </section>
  );
}

function Setting({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={styles.setting}>
      <span>
        <span className={styles.settingLabel}>{label}</span>
        {hint && <span className={styles.settingHint}>{hint}</span>}
      </span>
      {children}
    </div>
  );
}

/** Placeholder setting rendered as a disabled switch. */
function Placeholder({ label, hint, on = false }: { label: string; hint?: string; on?: boolean }) {
  return (
    <Setting label={label} hint={hint}>
      <Toggle label={label} checked={on} onChange={() => {}} disabled />
    </Setting>
  );
}

function ProfileSection() {
  const me = useSessionStore((s) => s.me)!;
  const setMe = useSessionStore((s) => s.setMe);
  const [name, setName] = useState(me.display_name);
  const [about, setAbout] = useState(me.about);
  const [username, setUsername] = useState(me.username ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = name !== me.display_name || about !== me.about || username !== (me.username ?? "");

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      setMe(await api.users.updateMe({ display_name: name.trim(), about, username }));
      toast("Profile updated");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't update profile");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save}>
      <div className={styles.profileEditor}>
        <AvatarPicker previewName={name} size={96} />
      </div>
      <label className={styles.formField}>
        <span>Name</span>
        <input className={styles.input} value={name} maxLength={64} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className={styles.formField}>
        <span>About</span>
        <input
          className={styles.input}
          value={about}
          maxLength={140}
          placeholder="Write a few words about yourself"
          onChange={(e) => setAbout(e.target.value)}
        />
      </label>
      <label className={styles.formField}>
        <span>Username</span>
        <input
          className={styles.input}
          value={username}
          maxLength={32}
          placeholder="e.g. alex.01"
          onChange={(e) => setUsername(e.target.value)}
        />
      </label>
      <label className={styles.formField}>
        <span>Phone number</span>
        <input className={styles.input} value={formatPhone(me.phone)} disabled />
      </label>
      <div className={styles.formActions}>
        <Button type="submit" disabled={!dirty || busy || !name.trim()}>
          Save
        </Button>
      </div>
    </form>
  );
}

function AppearanceSection() {
  const theme = useUIStore((s) => s.prefs.theme);
  const setPref = useUIStore((s) => s.setPref);
  const options: { value: ThemePref; label: string }[] = [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ];
  return (
    <>
      <Group title="Theme">
        <div role="radiogroup" aria-label="Theme">
          {options.map((o) => (
            <button
              key={o.value}
              className={styles.radio}
              role="radio"
              aria-checked={theme === o.value}
              onClick={() => setPref("theme", o.value)}
            >
              <span className={styles.radioDot} data-checked={theme === o.value} />
              {o.label}
            </button>
          ))}
        </div>
      </Group>
      <Group title="Chat" comingSoon>
        <Setting label="Chat color" hint="Ultramarine">
          <span />
        </Setting>
        <Setting label="Zoom level" hint="100%">
          <span />
        </Setting>
      </Group>
    </>
  );
}

function NotificationsSection() {
  const prefs = useUIStore((s) => s.prefs);
  const setPref = useUIStore((s) => s.setPref);
  const supported = typeof Notification !== "undefined";

  const toggleNotifications = async (enabled: boolean) => {
    if (enabled && supported && Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast("Notifications are blocked by your browser");
        return;
      }
    }
    setPref("notifications", enabled);
  };

  return (
    <>
      <Group title="Messages">
        <Setting
          label="Enable notifications"
          hint={supported ? "Desktop notifications for new messages" : "Not supported in this browser"}
        >
          <Toggle
            label="Enable notifications"
            checked={prefs.notifications && supported && Notification.permission === "granted"}
            disabled={!supported}
            onChange={(v) => void toggleNotifications(v)}
          />
        </Setting>
        <Setting label="Show name and message" hint="Otherwise notifications just say “New message”">
          <Toggle
            label="Show name and message"
            checked={prefs.notificationPreview}
            onChange={(v) => setPref("notificationPreview", v)}
          />
        </Setting>
      </Group>
      <Group title="Sounds" comingSoon>
        <Placeholder label="Notification sound" on />
        <Placeholder label="Play sounds while in chat" />
      </Group>
    </>
  );
}

function SectionContent({ section }: { section: SettingsSection }) {
  switch (section) {
    case "profile":
      return <ProfileSection />;
    case "appearance":
      return <AppearanceSection />;
    case "notifications":
      return <NotificationsSection />;
    case "general":
      return (
        <Group title="General" comingSoon>
          <Placeholder label="Spell check text entered in message composition box" on />
          <Placeholder label="Open at computer login" />
          <Placeholder label="Language" hint="System language" />
        </Group>
      );
    case "chats":
      return (
        <Group title="Chats" comingSoon>
          <Placeholder label="Generate link previews" on />
          <Placeholder label="Use system emoji" />
          <Placeholder label="Send messages with Enter" hint="Shift+Enter inserts a new line" on />
        </Group>
      );
    case "privacy":
      return (
        <>
          <Group title="Messaging" comingSoon>
            <Placeholder label="Read receipts" hint="Always on in this demo" on />
            <Placeholder label="Typing indicators" hint="Always on in this demo" on />
            <Placeholder label="Blocked" hint="0 contacts" />
          </Group>
          <Group title="Disappearing messages" comingSoon>
            <Placeholder label="Default timer for new chats" hint="Off" />
          </Group>
          <Group title="Encryption">
            <Setting
              label="End-to-end encryption"
              hint="Simulated for this assignment. Messages are stored in plain text on the demo server."
            >
              <span />
            </Setting>
          </Group>
        </>
      );
    case "devices":
      return (
        <EmptyState
          icon={<DevicesIcon size={36} />}
          badge="Coming soon"
          title="Linked devices"
          text="Use Signal on your desktop or iPad by linking it to this account. Coming soon."
        />
      );
  }
}

export function SettingsPage() {
  const section = useUIStore((s) => s.settingsSection);
  const close = useUIStore((s) => s.closeSettingsSection);
  return (
    <section className={styles.page} aria-label={TITLES[section]}>
      <header className={styles.pageHeader}>
        <IconButton label="Back" className={styles.pageBack} onClick={close}>
          <BackIcon />
        </IconButton>
        <h1 className={styles.pageTitle}>{TITLES[section]}</h1>
      </header>
      <div className={styles.pageBody}>
        <div className={styles.pageContent}>
          {/* Keyed by section so each section's local form state starts fresh. */}
          <SectionContent key={section} section={section} />
        </div>
      </div>
    </section>
  );
}
