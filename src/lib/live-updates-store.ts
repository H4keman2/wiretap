import { useCallback, useEffect, useState } from "react";

/**
 * Live waiver-watch preference. On by default — the waiver browser should
 * just be live without asking the user to opt in every visit — persisted so
 * a user who explicitly turns it off in Settings stays off across visits.
 * Mirrors use-theme.ts's read/apply/persist shape.
 */

const KEY = "wiretap.live-updates.v1";

function read(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === "0") return false;
    if (stored === "1") return true;
  } catch {
    /* storage unavailable, fall through to the default */
  }
  return true;
}

export function useLiveUpdates() {
  const [enabled, setEnabledState] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setEnabledState(read());
    setLoaded(true);
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    try {
      window.localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
  }, []);

  return { enabled, setEnabled, loaded };
}
