/**
 * Fast-moving injury feed.
 *
 * The merged player pool is cached for hours because ownership, ADP and
 * season stats barely move. Injury tags do the opposite — a starter can be
 * ruled out (or cleared) minutes before kickoff — so status is pulled on its
 * own short cycle and overlaid onto the cached pool. That's what lets the
 * waiver list react to an injury or a return without waiting for a full
 * rebuild.
 */

import type { RealPosition } from "./ranking";

const TTL_MS = 1000 * 45;

const POSITION_BY_ID: Record<number, RealPosition> = {
  1: "QB",
  2: "RB",
  3: "WR",
  4: "TE",
  5: "K",
  16: "DEF",
};

const SUFFIX = /\s+(jr|sr|ii|iii|iv|v)\.?$/i;

/** Same normalization the pool merge uses, so overlays line up by name+position. */
export function injuryKey(name: string, position: string): string {
  const clean = name
    .toLowerCase()
    .replace(/[.'`’-]/g, "")
    .replace(SUFFIX, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${clean}|${position}`;
}

export interface InjuryFeed {
  /** name|position -> injury tag, or null when the player is currently active. */
  byKey: Map<string, string | null>;
  fetchedAt: number;
}

const EMPTY: InjuryFeed = { byKey: new Map(), fetchedAt: 0 };

let cache: InjuryFeed | null = null;
let inflight: Promise<InjuryFeed> | null = null;

function seasonYear(): number {
  const now = new Date();
  return now.getUTCMonth() < 2 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
}

function endpoint(year: number) {
  return `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/players?scoringPeriodId=0&view=kona_player_info`;
}

/** Status-only filter — no stat splits, so this stays cheap enough to poll. */
const FILTER = JSON.stringify({
  players: { limit: 1500, sortPercOwned: { sortPriority: 1, sortAsc: false } },
});

interface RawPlayer {
  fullName?: string;
  defaultPositionId?: number;
  injuryStatus?: string | null;
}

function normalizeTag(status: string | null | undefined): string | null {
  if (!status) return null;
  const upper = status.toUpperCase();
  if (upper === "ACTIVE" || upper === "NORMAL") return null;
  return status;
}

async function build(): Promise<InjuryFeed> {
  const year = seasonYear();
  for (const y of [year, year - 1]) {
    try {
      const res = await fetch(endpoint(y), {
        headers: { accept: "application/json", "x-fantasy-filter": FILTER },
      });
      if (!res.ok) continue;
      const body = (await res.json()) as unknown;
      const rows: RawPlayer[] = Array.isArray(body)
        ? (body as RawPlayer[])
        : (((body as { players?: Array<{ player?: RawPlayer }> }).players ?? [])
            .map((r) => r.player)
            .filter(Boolean) as RawPlayer[]);

      const byKey = new Map<string, string | null>();
      for (const p of rows) {
        const position = POSITION_BY_ID[p.defaultPositionId ?? -1];
        if (!position || !p.fullName) continue;
        byKey.set(injuryKey(p.fullName, position), normalizeTag(p.injuryStatus));
      }
      if (byKey.size > 100) return { byKey, fetchedAt: Date.now() };
    } catch {
      // try the previous season key, then give up quietly
    }
  }
  return { ...EMPTY, fetchedAt: Date.now() };
}

/** Current injury tags, refreshed at most every 45 seconds. */
export async function getInjuryFeed(): Promise<InjuryFeed> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache;
  if (!inflight) {
    inflight = build()
      .then((feed) => {
        // Never let a failed poll wipe a good feed.
        if (feed.byKey.size > 0 || !cache) cache = feed;
        else cache = { ...cache, fetchedAt: Date.now() };
        return cache;
      })
      .catch(() => cache ?? EMPTY)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}
