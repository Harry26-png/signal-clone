"use client";

import { useEffect } from "react";
import { Spinner } from "@/components/common/Button";
import { Toasts } from "@/components/common/Toasts";
import { Messenger } from "@/components/layout/Messenger";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { useTheme } from "@/hooks/useTheme";
import { useSessionStore } from "@/store/session";
import { useUIStore } from "@/store/ui";

/** Client-only root: restores the session, then shows onboarding or the messenger. */
export function AppRoot() {
  const status = useSessionStore((s) => s.status);
  useTheme();

  useEffect(() => {
    useUIStore.getState().loadPrefs();
    void useSessionStore.getState().bootstrap();
  }, []);

  return (
    <>
      {status === "loading" ? (
        <div style={{ height: "100dvh", display: "grid", placeItems: "center" }}>
          <Spinner />
        </div>
      ) : status === "signedIn" ? (
        <Messenger />
      ) : (
        <Onboarding />
      )}
      <Toasts />
    </>
  );
}
