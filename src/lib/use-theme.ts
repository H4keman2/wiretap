import { useCallback, useEffect, useState } from "react";

/**
 * Light/dark theme toggle.
 *
 * The color tokens for both themes already exist in styles.css (the
 * `.dark` block), this hook just decides which one is active and persists
 * the choice. Falls back to the OS preference on first visit.
 */

export type Theme = "light" | "dark";

const KEY = "wiretap.theme.v1";

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function read(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* storage unavailable, fall through to OS preference */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const initial = read();
    setThemeState(initial);
    apply(initial);
    setLoaded(true);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    apply(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  return { theme, setTheme, loaded };
}
