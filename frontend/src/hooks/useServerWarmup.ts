"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

export type ServerState = "checking" | "ready" | "waking" | "unreachable";

const SLOW_AFTER_MS = 2500;
const RETRY_DELAY_MS = 3000;
const MAX_ATTEMPTS = 30;

/**
 * Pings the API as soon as the app loads. On free hosting the backend may be asleep; this both
 * starts waking it early and lets the UI explain the delay instead of looking frozen.
 */
export function useServerWarmup(): ServerState {
  const [state, setState] = useState<ServerState>("checking");

  useEffect(() => {
    let cancelled = false;
    const slowTimer = setTimeout(() => {
      if (!cancelled) setState((s) => (s === "checking" ? "waking" : s));
    }, SLOW_AFTER_MS);

    const ping = async () => {
      for (let attempt = 0; attempt < MAX_ATTEMPTS && !cancelled; attempt++) {
        try {
          const response = await fetch(`${API_URL}/health`, { cache: "no-store" });
          if (response.ok) {
            if (!cancelled) setState("ready");
            return;
          }
        } catch {
          /* still starting (or offline): retry below */
        }
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
      if (!cancelled) setState("unreachable");
    };
    void ping();

    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
    };
  }, []);

  return state;
}
