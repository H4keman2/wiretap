/**
 * ESPN private-league adapter.
 *
 * Reads one specific ESPN fantasy league (rosters, scoring, lineup slots)
 * using the user's own `espn_s2` / `SWID` session cookies. This is what turns
 * Wire Tap from "national ESPN averages" into "your league": who is actually
 * rostered, what your scoring really is, and what your own team looks like.
 *
 * The cookies live on the caller's device and are passed per request; nothing
 * is persisted server-side beyond a short in-memory snapshot cache.
 */

import type { RealPosition, ScoringFormat } from "./ranking";
import type { LeagueConfig } from "./weakness";

export interface EspnLeagueCred {
  leagueId: string;
  espnS2?: string | null;
  swid?: string | null;
  /** Optional season override; defaults to the current fantasy season. */
  season?: number | null;
}

export interface LeagueRosterPlayer {
  espnId: number;
  name: string;
  position: RealPosition | null;
  team: string | null;
  /** True when the player occupies a starting lineup slot in the league. */
  starter: boolean;
}

export interface LeagueTeam {
  id: number;
  name: string;
  roster: LeagueRosterPlayer[];
}

export interface LeagueSnapshot {
  leagueId: string;
  season: number;
  name: string;
  size: number;
  /** Scoring format inferred from the league's points-per-reception setting. */
  format: ScoringFormat;
  /** Starting slots + bench, read from the league's own lineup settings. */
  config: LeagueConfig;
  teams: LeagueTeam[];
  /** `name|POS` keys for every player rostered by any team in the league. */
  rosteredKeys: string[];
  /** FAAB budget when the league uses one, else null. */
  faabBudget: number | null;
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

/** Lineup slot ids that mean "not a starter". */
const NON_STARTER_SLOTS = new Set([20, 21, 24]);

const SUFFIX = /\s+(jr|sr|ii|iii|iv|v)\.?$/i;

/** Same normalisation the ESPN/Sleeper merge uses, so keys line up. */
export function playerKey(name: string, position: string): string {
  const clean = name
    .toLowerCase()
    .replace(/[.'`’-]/g, "")
    .replace(SUFFIX, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${clean}|${position}`;
}

interface RawRosterEntry {
  lineupSlotId?: number;
  playerPoolEntry?: {
    player?: {
      id?: number;
      fullName?: string;
      defaultPositionId?: number;
      proTeamId?: number;
    };
  };
}

interface RawTeam {
  id?: number;
  name?: string;
  location?: string;
  nickname?: string;
  abbrev?: string;
  roster?: { entries?: RawRosterEntry[] } | null;
}

interface RawLeague {
  settings?: {
    name?: string;
    size?: number;
    rosterSettings?: { lineupSlotCounts?: Record<string, number> };
    scoringSettings?: {
      scoringItems?: Array<{ statId?: number; points?: number }>;
    };
    acquisitionSettings?: { acquisitionBudget?: number; waiverProcessDays?: string[] };
  };
  teams?: RawTeam[];
}

export class LeagueAccessError extends Error {
  constructor(
    message: string,
    readonly code: "auth" | "not_found" | "unavailable",
  ) {
    super(message);
  }
}

function seasonYear(): number {
  const now = new Date();
  return now.getUTCMonth() < 2 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
}

function cookieHeader(cred: EspnLeagueCred): string | null {
  const bits: string[] = [];
  if (cred.espnS2?.trim()) bits.push(`espn_s2=${cred.espnS2.trim()}`);
  if (cred.swid?.trim()) {
    const swid = cred.swid.trim();
    bits.push(`SWID=${swid.startsWith("{") ? swid : `{${swid}}`}`);
  }
  return bits.length ? bits.join("; ") : null;
}

function slotCounts(counts: Record<string, number> | undefined): LeagueConfig {
  const n = (id: number) => Math.max(0, Math.round(counts?.[String(id)] ?? 0));
  return {
    QB: n(0),
    RB: n(2),
    WR: n(4),
    TE: n(6),
    // FLEX-ish slots: RB/WR, WR/TE, RB/WR/TE, superflex/OP.
    FLEX: n(23) + n(3) + n(5) + n(7),
    DST: n(16),
    K: n(17),
    bench: n(20),
  };
}

/** ESPN stat 53 = receptions; its point value tells us the league's format. */
function formatFrom(items: Array<{ statId?: number; points?: number }> | undefined): ScoringFormat {
  const rec = items?.find((i) => i.statId === 53)?.points ?? 0;
  if (rec >= 0.75) return "ppr";
  if (rec >= 0.25) return "half";
  return "std";
}

function teamName(t: RawTeam): string {
  const composed = [t.location, t.nickname].filter(Boolean).join(" ").trim();
  return t.name?.trim() || composed || t.abbrev || `Team ${t.id ?? "?"}`;
}

async function fetchLeague(cred: EspnLeagueCred, season: number): Promise<LeagueSnapshot> {
  const url =
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}` +
    `/segments/0/leagues/${encodeURIComponent(cred.leagueId)}` +
    `?view=mTeam&view=mSettings&view=mRoster`;

  const cookie = cookieHeader(cred);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "Mozilla/5.0 (compatible; WireTap/1.0)",
        ...(cookie ? { cookie } : {}),
      },
    });
  } catch {
    throw new LeagueAccessError("Couldn't reach ESPN right now.", "unavailable");
  }

  if (res.status === 401 || res.status === 403) {
    throw new LeagueAccessError(
      "ESPN says this league is private. Add your espn_s2 and SWID values from a signed-in ESPN browser session.",
      "auth",
    );
  }
  if (res.status === 404) {
    throw new LeagueAccessError("No ESPN league found with that ID for this season.", "not_found");
  }
  if (!res.ok) {
    throw new LeagueAccessError("ESPN returned an error for that league.", "unavailable");
  }

  const body = (await res.json()) as RawLeague;
  const rawTeams = body.teams ?? [];

  const teams: LeagueTeam[] = rawTeams.map((t) => ({
    id: t.id ?? 0,
    name: teamName(t),
    roster: (t.roster?.entries ?? [])
      .map((e): LeagueRosterPlayer | null => {
        const p = e.playerPoolEntry?.player;
        if (!p?.fullName) return null;
        return {
          espnId: p.id ?? 0,
          name: p.fullName,
          position: POSITION_BY_ID[p.defaultPositionId ?? -1] ?? null,
          team: TEAM_BY_ID[p.proTeamId ?? -1] ?? null,
          starter: !NON_STARTER_SLOTS.has(e.lineupSlotId ?? 20),
        };
      })
      .filter((p): p is LeagueRosterPlayer => p !== null),
  }));

  const rosteredKeys = new Set<string>();
  for (const t of teams) {
    for (const p of t.roster) {
      if (p.position) rosteredKeys.add(playerKey(p.name, p.position));
    }
  }

  const budget = body.settings?.acquisitionSettings?.acquisitionBudget ?? 0;

  return {
    leagueId: cred.leagueId,
    season,
    name: body.settings?.name?.trim() || `League ${cred.leagueId}`,
    size: body.settings?.size ?? teams.length,
    format: formatFrom(body.settings?.scoringSettings?.scoringItems),
    config: slotCounts(body.settings?.rosterSettings?.lineupSlotCounts),
    teams,
    rosteredKeys: [...rosteredKeys],
    faabBudget: budget > 0 ? budget : null,
  };
}

const TTL_MS = 1000 * 60 * 3;
const cache = new Map<string, { at: number; snap: LeagueSnapshot }>();

/** Cached league read — three minutes is plenty for a waiver session. */
export async function getLeagueSnapshot(cred: EspnLeagueCred): Promise<LeagueSnapshot> {
  const season = cred.season ?? seasonYear();
  const ck = `${cred.leagueId}|${season}|${cred.swid ?? ""}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.snap;

  let snap: LeagueSnapshot;
  try {
    snap = await fetchLeague(cred, season);
  } catch (err) {
    // Off-season / brand-new season keys often only exist for last year.
    if (err instanceof LeagueAccessError && err.code === "not_found" && !cred.season) {
      snap = await fetchLeague(cred, season - 1);
    } else {
      throw err;
    }
  }
  cache.set(ck, { at: Date.now(), snap });
  return snap;
}
