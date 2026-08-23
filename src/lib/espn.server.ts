/**
 * ESPN Fantasy public read API adapter (no auth required).
 *
 * Unlike Sleeper, ESPN publishes true league-wide roster percentages
 * (`ownership.percentOwned`), start percentages, and ADP for every player.
 * This is the primary ownership source for Wire Tap.
 */

import type { RealPosition } from "./ranking";
import type { SeasonStats } from "./season-stats";

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
  /** Totals from the most recent completed NFL season, when published. */
  lastSeason: SeasonStats | null;
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

interface RawStatEntry {
  seasonId?: number;
  scoringPeriodId?: number;
  statSourceId?: number;
  statSplitTypeId?: number;
  stats?: Record<string, number>;
}

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
  stats?: RawStatEntry[] | null;
}

/** ESPN stat IDs for the season splits we surface. */
const STAT = {
  passYds: "3",
  passTd: "4",
  interceptions: "20",
  rushAtt: "23",
  rushYds: "24",
  rushTd: "25",
  recYds: "42",
  recTd: "43",
  receptions: "53",
  targets: "58",
  games: "210",
} as const;

function num(map: Record<string, number>, id: string): number {
  const v = map[id];
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10) / 10 : 0;
}

/** Pick the newest real (statSourceId 0) full-season split with games played. */
function parseLastSeason(rows: RawStatEntry[] | null | undefined): SeasonStats | null {
  if (!rows) return null;
  const totals = rows
    .filter(
      (r) =>
        r.statSourceId === 0 &&
        r.statSplitTypeId === 0 &&
        r.scoringPeriodId === 0 &&
        r.stats &&
        (r.stats[STAT.games] ?? 0) > 0,
    )
    .sort((a, b) => (b.seasonId ?? 0) - (a.seasonId ?? 0));
  const row = totals[0];
  if (!row?.stats || !row.seasonId) return null;
  const m = row.stats;
  return {
    season: row.seasonId,
    games: num(m, STAT.games),
    passYds: num(m, STAT.passYds),
    passTd: num(m, STAT.passTd),
    interceptions: num(m, STAT.interceptions),
    rushAtt: num(m, STAT.rushAtt),
    rushYds: num(m, STAT.rushYds),
    rushTd: num(m, STAT.rushTd),
    targets: num(m, STAT.targets),
    receptions: num(m, STAT.receptions),
    recYds: num(m, STAT.recYds),
    recTd: num(m, STAT.recTd),
  };
}

function seasonYear(): number {
  const now = new Date();
  // The fantasy season is keyed to the calendar year until roughly February.
  return now.getUTCMonth() < 2 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
}

function endpoint(year: number) {
  return `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/players?scoringPeriodId=0&view=kona_player_info`;
}

function filterFor(year: number) {
  return JSON.stringify({
    players: {
      limit: 1500,
      sortPercOwned: { sortPriority: 1, sortAsc: false },
      // Ask for real season totals for this season and the previous one; the
      // newest split with games played becomes the card's "last season" block.
      filterStatsForExternalIds: { value: [year, year - 1] },
      filterStatsForSourceIds: { value: [0] },
      filterStatsForSplitTypeIds: { value: [0] },
    },
  });
}

/** Pull the full ESPN player universe with real ownership data. */
export async function fetchEspnPlayers(): Promise<EspnPlayer[]> {
  const year = seasonYear();
  const years = [year, year - 1];

  for (const y of years) {
    try {
      const res = await fetch(endpoint(y), {
        headers: {
          accept: "application/json",
          "x-fantasy-filter": filterFor(y),
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
          lastSeason: parseLastSeason(p.stats),
        });
      }
      if (out.length > 100) return out;
    } catch {
      // fall through to the next season key
    }
  }
  return [];
}
