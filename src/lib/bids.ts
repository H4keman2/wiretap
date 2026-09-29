import { useCallback, useEffect, useState } from "react";

import type { RankedPlayer } from "./ranking";

/**
 * Suggested FAAB bid as a share of the season budget, driven by the Wire Tap
 * score, nudged up for rising players and down for injured ones, and never
 * more than what's left.
 */
export function suggestBid(p: RankedPlayer, total: number, remaining: number): number {
  if (remaining <= 0) return 0;
  const s = p.score;
  let share = s >= 8.5 ? 0.2 : s >= 7.5 ? 0.13 : s >= 6.5 ? 0.08 : s >= 5.5 ? 0.04 : s >= 4.5 ? 0.02 : 0.01;
  if (p.trendLabel === "rising") share *= 1.25;
  if (p.injury) share *= 0.6;
  return Math.max(1, Math.min(remaining, Math.round(total * share)));
}

export interface PlannedBid {
  id: string;
  name: string;
  position: string;
  team: string | null;
  amount: number;
  suggested: number;
  at: number;
}

const KEY = "wiretap.bids.v1";

/** Bids you plan to enter in ESPN, saved on this device only. */
export function useBids() {
  const [bids, setBids] = useState<PlannedBid[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setBids(JSON.parse(raw) as PlannedBid[]);
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((next: PlannedBid[]) => {
    setBids(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const upsert = useCallback(
    (bid: PlannedBid) => {
      setBids((prev) => {
        const next = [bid, ...prev.filter((b) => b.id !== bid.id)];
        try {
          window.localStorage.setItem(KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [],
  );

  const remove = useCallback(
    (id: string) => persist(bids.filter((b) => b.id !== id)),
    [bids, persist],
  );

  const clear = useCallback(() => persist([]), [persist]);

  return { bids, upsert, remove, clear };
}
