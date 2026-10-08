"use client";

import { useEffect } from "react";
import { useUIStore } from "@/store/ui";

/** Applies the theme preference as <html data-theme>; "system" follows the OS setting live. */
export function useTheme() {
  const theme = useUIStore((s) => s.prefs.theme);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved = theme === "system" ? (media.matches ? "dark" : "light") : theme;
      document.documentElement.dataset.theme = resolved;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
}
