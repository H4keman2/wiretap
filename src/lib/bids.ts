import { useCallback, useEffect, useState } from "react";

import type { RankedPlayer } from "./ranking";

/**
 * Suggested FAAB bid as a share of the season budget, driven by the Wire Tap
 * score, nudged up for rising players and down for injured ones, and never
 * more than what's left.
 */
const MIN_BID = 1;
/** Score -> budget share. Higher-scored targets are worth a bigger slice. */
const SHARE_BY_SCORE: Array<[minScore: number, share: number]> = [
  [8.5, 0.2], // elite target: a fifth of the budget
  [7.5, 0.13], // strong target
  [6.5, 0.08], // solid starter-quality
  [5.5, 0.04], // streamer / upside stash
  [4.5, 0.02], // deep dart throw
  [0, 0.01], // everyone else: token bid
];
/** Rising players get bid up; injured ones get discounted. */
const RISING_MULTIPLIER = 1.25;
const INJURED_MULTIPLIER = 0.6;

export function suggestBid(p: RankedPlayer, total: number, remaining: number): number {
  if (remaining <= 0) return 0;
  const share = SHARE_BY_SCORE.find(([min]) => p.score >= min)?.[1] ?? 0.01;
  let adjusted = share;
  if (p.trendLabel === "rising") adjusted *= RISING_MULTIPLIER;
  if (p.injury) adjusted *= INJURED_MULTIPLIER;
  return Math.max(MIN_BID, Math.min(remaining, Math.round(total * adjusted)));
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
    (id: string) => {
      setBids((prev) => {
        const next = prev.filter((b) => b.id !== id);
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

  const clear = useCallback(() => persist([]), [persist]);

  return { bids, upsert, remove, clear };
}
