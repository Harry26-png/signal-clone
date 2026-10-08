"use client";

import { useEffect, useState } from "react";

/** Re-renders periodically so relative times ("5m", "Last seen 2 minutes ago") stay fresh. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
