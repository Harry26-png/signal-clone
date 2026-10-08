"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/common/Avatar";
import { Button } from "@/components/common/Button";
import { CameraIcon } from "@/components/common/icons";
import styles from "@/components/onboarding/onboarding.module.css";
import { api, ApiError } from "@/lib/api";
import { AVATAR_COLOR_KEYS, avatarColors } from "@/lib/avatar";
import { useSessionStore } from "@/store/session";
import { toast } from "@/store/ui";

/** Profile photo upload/removal plus the initials colour picker. Saves immediately. */
export function AvatarPicker({ previewName, size = 88 }: { previewName: string; size?: number }) {
  const me = useSessionStore((s) => s.me)!;
  const setMe = useSessionStore((s) => s.setMe);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<typeof me>) => {
    setBusy(true);
    try {
      setMe(await action());
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't update your photo");
    } finally {
      setBusy(false);
    }
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Choose an image file");
      return;
    }
    void run(async () => api.users.setAvatar((await api.attachments.upload(file)).id));
  };

  return (
    <>
      <button
        type="button"
        className={styles.profileAvatar}
        onClick={() => fileInput.current?.click()}
        disabled={busy}
        aria-label="Choose profile photo"
      >
        <Avatar size={size} name={previewName} color={me.avatar_color} imageUrl={me.avatar_url} />
        <span className={styles.cameraBadge}>
          <CameraIcon size={18} />
        </span>
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {me.avatar_url ? (
        <Button variant="ghost" type="button" onClick={() => void run(() => api.users.setAvatar(null))} disabled={busy}>
          Remove photo
        </Button>
      ) : (
        <div className={styles.colors} role="group" aria-label="Avatar colour">
          {AVATAR_COLOR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={styles.colorSwatch}
              style={{ background: avatarColors(key).fg }}
              aria-pressed={me.avatar_color === key}
              aria-label={`Colour ${key}`}
              onClick={() => void run(() => api.users.updateMe({ avatar_color: key }))}
            />
          ))}
        </div>
      )}
    </>
  );
}
