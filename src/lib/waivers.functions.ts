import { createServerFn } from "@tanstack/react-start";

import { findHandcuffs, type HandcuffSuggestion } from "./handcuffs";
import { requireValidLicense } from "./license.server";
import { suggestLineup } from "./lineup";
import {
  projectPoints,
  rankWaiverPool,
  replacementBaseline,
  type RankedPlayer,
  type RealPosition,
  type ScoringFormat,
  type SlotPosition,
} from "./ranking";
import {
  analyzeRoster,
  type LeagueConfig,
  type PositionVerdict,
  type RosterEntry,
} from "./weakness";

import type { LeagueCred } from "./league.functions";
import type { PlayerStat } from "./ranking";

export interface RecommendationInput {
  format: ScoringFormat;
  slot: SlotPosition;
  maxOwnership: number;
  /** When present, availability comes from this ESPN league instead of national ownership. */
  league?: LeagueCred | null;
}

/**
 * Swap national ownership for the user's own league: drop everyone rostered
 * by any team in that league, and mark the rest as genuinely free there.
 * National ownership is kept alongside as an interest signal.
 */
async function applyLeagueAvailability(
  pool: PlayerStat[],
  league: LeagueCred,
): Promise<PlayerStat[]> {
  const { getLeagueSnapshot, playerKey } = await import("./espn-league.server");
  const snap = await getLeagueSnapshot(league);
  const rostered = new Set(snap.rosteredKeys);
  return pool
    .filter((p) => !rostered.has(playerKey(p.name, p.position)))
    .map((p) => ({
      ...p,
      nationalOwnership: p.ownership,
      ownership: 0,
      ownershipSource: "league" as const,
    }));
}

export const getRecommendations = createServerFn({ method: "GET" })
  .inputValidator((data: RecommendationInput) => data)
  .handler(async ({ data }): Promise<RankedPlayer[]> => {
    const { getPlayerPool } = await import("./players.server");
    const base = await getPlayerPool();
    const pool = data.league?.leagueId ? await applyLeagueAvailability(base, data.league) : base;
    // No `limit` here — show every eligible player under the threshold, not
    // just a top handful. rankWaiverPool still applies its own hard ceiling.
    return rankWaiverPool(pool, {
      format: data.format,
      slot: data.slot,
      maxOwnership: data.league?.leagueId ? 101 : data.maxOwnership,
    });
  });


export const getWatchlistPlayers = createServerFn({ method: "GET" })
  .inputValidator((data: { ids: string[]; format: ScoringFormat }) => data)
  .handler(async ({ data }): Promise<RankedPlayer[]> => {
    if (data.ids.length === 0) return [];
    const { getPlayerPool } = await import("./players.server");
    const { scorePlayer } = await import("./ranking");
    const pool = await getPlayerPool();
    const wanted = new Set(data.ids);
    const order = new Map(data.ids.map((id, i) => [id, i]));
    return pool
      .filter((p) => wanted.has(p.id))
      .map((p) => scorePlayer(p, data.format))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  });

export const searchPlayers = createServerFn({ method: "GET" })
  .inputValidator((data: { query: string }) => data)
  .handler(
    async ({
      data,
    }): Promise<Array<{ id: string; name: string; team: string | null; position: string }>> => {
      const q = data.query.trim().toLowerCase();
      if (q.length < 2) return [];
      const { getPlayerPool } = await import("./players.server");
      const pool = await getPlayerPool();
      return pool
        .filter((p) => p.name.toLowerCase().includes(q))
        .sort((a, b) => b.ownership - a.ownership)
        .slice(0, 8)
        .map((p) => ({ id: p.id, name: p.name, team: p.team, position: p.position }));
    },
  );

const SUFFIX = /\s+(jr|sr|ii|iii|iv|v)\.?$/i;

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.'`’-]/g, "")
    .replace(SUFFIX, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Recognized trailing position hints a pasted roster line might carry (e.g. "David Montgomery RB"). */
const POSITION_HINTS: Record<string, RealPosition> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  PK: "K",
  DST: "DEF",
  DEF: "DEF",
  DE: "DEF",
};

function parseImportLine(raw: string): { name: string; hint: RealPosition | null } {
  // Bulk-import lines commonly look like "Name", "Name, RB", "Name - RB", or
  // "Name (RB)" when pasted straight out of another platform's roster page.
  const cleaned = raw.replace(/[,()]/g, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    const last = parts[parts.length - 1]!.toUpperCase();
    const hint = POSITION_HINTS[last];
    if (hint) return { name: parts.slice(0, -1).join(" "), hint };
  }
  return { name: cleaned, hint: null };
}

export interface RosterMatchResult {
  /** The original pasted line, so the UI can show what it was matched from. */
  query: string;
  /** False when we couldn't confidently match a real player record. */
  matched: boolean;
  /** A real player id when matched; a stable `manual-*` fallback id otherwise. */
  id: string;
  name: string;
  team: string | null;
  /** Best-guess position — from the matched record, or a parsed hint. Null when we truly can't tell. */
  position: RealPosition | null;
}

/**
 * Bulk-import matcher for the "paste your roster" flow. Each non-empty line
 * is matched independently against the player pool by name (with an
 * optional trailing position hint to disambiguate, e.g. "David Montgomery
 * RB"). A line that can't be confidently matched still comes back as a
 * usable roster entry — `matched: false` with a manual fallback id — so the
 * caller can add it (flagged for review) instead of silently dropping it.
 */
export const matchRosterPlayers = createServerFn({ method: "POST" })
  .inputValidator((data: { lines: string[] }) => data)
  .handler(async ({ data }): Promise<RosterMatchResult[]> => {
    const { getPlayerPool } = await import("./players.server");
    const pool = await getPlayerPool();

    return data.lines
      .map((raw) => raw.trim())
      .filter(Boolean)
      .map((raw) => {
        const { name, hint } = parseImportLine(raw);
        const q = normalizeName(name);
        const candidates = hint ? pool.filter((p) => p.position === hint) : pool;

        const exact = q ? candidates.find((p) => normalizeName(p.name) === q) : undefined;
        const chosen =
          exact ??
          (q
            ? candidates
                .filter((p) => {
                  const n = normalizeName(p.name);
                  return n.includes(q) || q.includes(n);
                })
                .sort((a, b) => b.ownership - a.ownership)[0]
            : undefined);

        if (chosen) {
          return {
            query: raw,
            matched: true,
            id: chosen.id,
            name: chosen.name,
            team: chosen.team,
            position: chosen.position,
          };
        }

        return {
          query: raw,
          matched: false,
          id: `manual-${(name || raw).trim().toLowerCase()}`,
          name: name || raw,
          team: null,
          position: hint,
        };
      });
  });

export interface AnalyzeInput {
  format: ScoringFormat;
  config: LeagueConfig;
  roster: RosterEntry[];
  maxOwnership: number;
  overrideSlot?: SlotPosition | null;
  /** When present, waiver targets come from this ESPN league's free agents. */
  league?: LeagueCred | null;
  /** Required. Verified server-side on every call — this is the real paywall. */
  licenseKey: string;

}

/** Projected weekly points for one roster entry, and whether it came from a real matched player record. */
export interface RosterPoint {
  id: string;
  projection: number;
  matched: boolean;
}

export interface AnalyzeOutput {
  verdicts: PositionVerdict[];
  targetSlot: SlotPosition;
  recommendations: RankedPlayer[];
  /** Per-roster-entry projection, for the "team average" stat and lineup tools. */
  rosterPoints: RosterPoint[];
  /** The point-optimal starter set given the league's slots — feeds "Auto-set lineup". */
  suggestedStarterIds: string[];
  /** Direct backups to rostered starters, available on the wire. */
  handcuffs: HandcuffSuggestion[];
}

export const analyzeTeam = createServerFn({ method: "POST" })
  .inputValidator((data: AnalyzeInput) => data)
  .handler(async ({ data }): Promise<AnalyzeOutput> => {
    // Gate here, not just in the UI. A direct call to this function with no
    // or bad license bypassed the paywall entirely before this check existed.
    await requireValidLicense(data.licenseKey);

    const { getPlayerPool } = await import("./players.server");
    const pool = await getPlayerPool();
    const stats = new Map(pool.map((p) => [p.id, p]));

    const verdicts = analyzeRoster(data.roster, stats, data.config, data.format);
    const targetSlot = data.overrideSlot ?? verdicts[0]?.slot ?? "RB";

    const rosterPoints: RosterPoint[] = data.roster.map((r) => {
      const s = stats.get(r.id);
      return {
        id: r.id,
        projection: s
          ? projectPoints(s, data.format)
          : replacementBaseline(r.position, data.format) * 0.9,
        matched: !!s,
      };
    });

    const suggestedStarterIds = suggestLineup(data.roster, stats, data.config, data.format);
    const handcuffs = findHandcuffs(data.roster, pool);
    const handcuffOfById = new Map(handcuffs.map((h) => [h.handcuff.id, h.starterName]));

    const rosterIds = new Set(data.roster.map((r) => r.id));
    const available = pool.filter((p) => !rosterIds.has(p.id));
    const wire = data.league?.leagueId
      ? await applyLeagueAvailability(available, data.league)
      : available;
    const recommendations = rankWaiverPool(wire, {
      format: data.format,
      slot: targetSlot,
      maxOwnership: data.league?.leagueId ? 101 : data.maxOwnership,
    },

    ).map((p) => ({ ...p, handcuffOf: handcuffOfById.get(p.id) ?? null }));

    return { verdicts, targetSlot, recommendations, rosterPoints, suggestedStarterIds, handcuffs };
  });
