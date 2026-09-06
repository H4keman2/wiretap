import { Link } from "@tanstack/react-router";
import { Radio, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { RankedPlayer } from "@/lib/ranking";
import { cn } from "@/lib/utils";

export const LIVE_REFRESH_MS = 60_000;

/**
 * Tracks which players have newly dropped under the current ownership
 * threshold, keyed by the active filter combination so switching position or
 * format doesn't flag the entire list as "new".
 */
export function useLiveWatch(data: RankedPlayer[] | undefined, watchKey: string, enabled: boolean) {
  const seen = useRef<{ key: string; ids: Set<string> } | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.map((p) => p.id));
    const prev = seen.current;
    seen.current = { key: watchKey, ids };
    setLastUpdate(Date.now());

    if (!enabled || !prev || prev.key !== watchKey) {
      setNewIds(new Set());
      return;
    }
    const fresh = new Set([...ids].filter((id) => !prev.ids.has(id)));
    setNewIds(fresh);
  }, [data, watchKey, enabled]);

  useEffect(() => {
    if (!enabled) setNewIds(new Set());
  }, [enabled]);

  return { newIds, lastUpdate };
}

/**
 * Live is on by default app-wide now (see live-updates-store.ts) instead of
 * a per-page toggle the user had to remember to flip. This just states
 * what's happening and points at Settings for the one person in a hundred
 * who wants to turn it off — it doesn't control anything itself.
 */
export function LiveStatusNote({
  enabled,
  isFetching,
  lastUpdate,
  newCount,
}: {
  enabled: boolean;
  isFetching: boolean;
  lastUpdate: number | null;
  newCount: number;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, [enabled]);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          enabled ? "bg-action/15 text-turf" : "bg-secondary text-muted-foreground",
        )}
      >
        {enabled && isFetching ? (
          <RefreshCw className="size-4 animate-spin" strokeWidth={3} />
        ) : (
          <Radio className={cn("size-4", enabled && "animate-pulse")} strokeWidth={3} />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-black uppercase tracking-tight">
          {enabled ? "Live" : "Live updates are off"}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {enabled
            ? `Refreshing every 60s · ${ago(lastUpdate)}${
                newCount > 0 ? ` · ${newCount} new under threshold` : ""
              }`
            : "Turn this back on in Settings to auto-refresh and flag new availability."}
        </p>
      </div>

      <Link
        to="/settings"
        className="shrink-0 text-[10px] font-black uppercase tracking-wide text-turf underline"
      >
        Settings
      </Link>
    </div>
  );
}

function ago(at: number | null) {
  if (!at) return "waiting for data";
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 10) return "just updated";
  if (s < 60) return `updated ${s}s ago`;
  return `updated ${Math.round(s / 60)}m ago`;
}
