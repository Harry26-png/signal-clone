"use client";

import { useEffect } from "react";
import { Spinner } from "@/components/common/Button";
import commonStyles from "@/components/common/common.module.css";
import { Toasts } from "@/components/common/Toasts";
import { Messenger } from "@/components/layout/Messenger";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { type ServerState, useServerWarmup } from "@/hooks/useServerWarmup";
import { useTheme } from "@/hooks/useTheme";
import { useSessionStore } from "@/store/session";
import { useUIStore } from "@/store/ui";

function ServerBanner({ state }: { state: ServerState }) {
  if (state !== "waking" && state !== "unreachable") return null;
  return (
    <div className={commonStyles.serverBanner} role="status">
      {state === "waking" ? (
        <>
          <span className={commonStyles.spinnerSmall} />
          Waking up the server. The free hosting tier sleeps when idle, so this can take up to a minute.
        </>
      ) : (
        "Can't reach the server right now. Please refresh in a minute."
      )}
    </div>
  );
}

/** Client-only root: restores the session, then shows onboarding or the messenger. */
export function AppRoot() {
  const status = useSessionStore((s) => s.status);
  const server = useServerWarmup();
  useTheme();

  useEffect(() => {
    useUIStore.getState().loadPrefs();
    void useSessionStore.getState().bootstrap();
  }, []);

  return (
    <>
      <ServerBanner state={server} />
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
