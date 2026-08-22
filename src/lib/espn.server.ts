/**
 * ESPN Fantasy public read API adapter (no auth required).
 *
 * Unlike Sleeper, ESPN publishes true league-wide roster percentages
 * (`ownership.percentOwned`), start percentages, and ADP for every player.
 * This is the primary ownership source for Wire Tap.
 */

import type { RealPosition } from "./ranking";

export interface EspnPlayer {
  name: string;
  team: string | null;
  position: RealPosition;
  /** Real % of ESPN leagues rostering the player. */
  percentOwned: number;
  /** Real % of ESPN leagues starting the player. */
  percentStarted: number;
  /** Week-over-week change in rostered %. */
  percentChange: number;
  adp: number | null;
  injury: string | null;
}

const POSITION_BY_ID: Record<number, RealPosition> = {
  1: "QB",
  2: "RB",
  3: "WR",
  4: "TE",
  5: "K",
  16: "DEF",
};

const TEAM_BY_ID: Record<number, string> = {
  1: "ATL",
  2: "BUF",
  3: "CHI",
  4: "CIN",
  5: "CLE",
  6: "DAL",
  7: "DEN",
  8: "DET",
  9: "GB",
  10: "TEN",
  11: "IND",
  12: "KC",
  13: "LV",
  14: "LAR",
  15: "MIA",
  16: "MIN",
  17: "NE",
  18: "NO",
  19: "NYG",
  20: "NYJ",
  21: "PHI",
  22: "ARI",
  23: "PIT",
  24: "LAC",
  25: "SF",
  26: "SEA",
  27: "TB",
  28: "WAS",
  29: "CAR",
  30: "JAX",
  33: "BAL",
  34: "HOU",
};

interface RawEspnPlayer {
  fullName?: string;
  active?: boolean;
  defaultPositionId?: number;
  proTeamId?: number;
  injuryStatus?: string | null;
  ownership?: {
    percentOwned?: number;
    percentStarted?: number;
    percentChange?: number;
    averageDraftPosition?: number;
  } | null;
}

function seasonYear(): number {
  const now = new Date();
  // The fantasy season is keyed to the calendar year until roughly February.
  return now.getUTCMonth() < 2 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
}

function endpoint(year: number) {
  return `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/players?scoringPeriodId=0&view=kona_player_info`;
}

const FILTER = JSON.stringify({
  players: {
    limit: 1500,
    sortPercOwned: { sortPriority: 1, sortAsc: false },
  },
});

/** Pull the full ESPN player universe with real ownership data. */
export async function fetchEspnPlayers(): Promise<EspnPlayer[]> {
  const year = seasonYear();
  const years = [year, year - 1];

  for (const y of years) {
    try {
      const res = await fetch(endpoint(y), {
        headers: {
          accept: "application/json",
          "x-fantasy-filter": FILTER,
        },
      });
      if (!res.ok) continue;
      const body = (await res.json()) as unknown;
      const rows: RawEspnPlayer[] = Array.isArray(body)
        ? (body as RawEspnPlayer[])
        : (((body as { players?: Array<{ player?: RawEspnPlayer }> }).players ?? [])
            .map((r) => r.player)
            .filter(Boolean) as RawEspnPlayer[]);

      const out: EspnPlayer[] = [];
      for (const p of rows) {
        const position = POSITION_BY_ID[p.defaultPositionId ?? -1];
        if (!position || !p.fullName) continue;
        const own = p.ownership ?? {};
        out.push({
          name: p.fullName,
          team: TEAM_BY_ID[p.proTeamId ?? -1] ?? null,
          position,
          percentOwned: Math.max(0, Math.min(100, own.percentOwned ?? 0)),
          percentStarted: Math.max(0, Math.min(100, own.percentStarted ?? 0)),
          percentChange: own.percentChange ?? 0,
          adp: own.averageDraftPosition && own.averageDraftPosition > 0 ? own.averageDraftPosition : null,
          injury:
            p.injuryStatus && p.injuryStatus !== "ACTIVE" && p.injuryStatus !== "NORMAL"
              ? p.injuryStatus
              : null,
        });
      }
      if (out.length > 100) return out;
    } catch {
      // fall through to the next season key
    }
  }
  return [];
}
