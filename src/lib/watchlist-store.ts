import { useCallback, useEffect, useState } from "react";

const KEY = "wiretap.watchlist.v1";
const EVENT = "wiretap:watchlist";

export interface WatchlistEntry {
  id: string;
  name: string;
  team: string | null;
  position: string;
  addedAt: number;
}

function read(): WatchlistEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WatchlistEntry[];
    return Array.isArray(parsed) ? parsed.filter((e) => e && typeof e.id === "string") : [];
  } catch {
    return [];
  }
}

function write(entries: WatchlistEntry[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Saved players, persisted locally so no login is needed. */
export function useWatchlist() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const sync = () => setEntries(read());
    sync();
    setLoaded(true);
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const has = useCallback((id: string) => entries.some((e) => e.id === id), [entries]);

  const add = useCallback((entry: Omit<WatchlistEntry, "addedAt">) => {
    const next = read().filter((e) => e.id !== entry.id);
    write([{ ...entry, addedAt: Date.now() }, ...next]);
  }, []);

  const remove = useCallback((id: string) => {
    write(read().filter((e) => e.id !== id));
  }, []);

  const toggle = useCallback(
    (entry: Omit<WatchlistEntry, "addedAt">) => {
      if (read().some((e) => e.id === entry.id)) remove(entry.id);
      else add(entry);
    },
    [add, remove],
  );

  const clear = useCallback(() => write([]), []);

  return { entries, loaded, has, add, remove, toggle, clear };
}
