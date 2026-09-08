/**
 * Lineup slot assignment — shared between the client (instant "which slot
 * does a newly-added player default into" heuristic) and the server (the
 * point-aware "best possible starting lineup" suggestion).
 *
 * Deliberately has no ".server" suffix and no server-only imports: both
 * halves are pure functions over data the caller already has, so either
 * side can call them.
 */

import {
  projectPoints,
  replacementBaseline,
  type PlayerStat,
  type RealPosition,
  type ScoringFormat,
  type SlotPosition,
} from "./ranking";
import type { LeagueConfig, RosterEntry } from "./weakness";

export const FLEX_ELIGIBLE: RealPosition[] = ["RB", "WR", "TE"];

/** The direct (non-FLEX) lineup slot a real-world position fills. */
export function directSlotFor(position: RealPosition): keyof LeagueConfig {
  return position === "DEF" ? "DST" : (position as Exclude<SlotPosition, "FLEX" | "DST">);
}

/**
 * Per-slot starter counts: how many of each slot the roster currently has
 * filled versus the league's configured requirement. Pure and instant —
 * no player stats needed — so the UI can show it on every keystroke.
 */
export interface SlotFill {
  slot: SlotPosition;
  filled: number;
  required: number;
}

export function lineupFill(roster: RosterEntry[], config: LeagueConfig): SlotFill[] {
  const starters = roster.filter((r) => r.starter);
  const directSlots: Array<Exclude<SlotPosition, "FLEX">> = ["QB", "RB", "WR", "TE", "DST", "K"];

  const fills: SlotFill[] = directSlots.map((slot) => {
    const real: RealPosition = slot === "DST" ? "DEF" : slot;
    const have = starters.filter((r) => r.position === real).length;
    return { slot, filled: Math.min(have, config[slot]), required: config[slot] };
  });

  // Anything starting beyond a position's own direct requirement counts
  // against the shared FLEX pool (RB/WR/TE only).
  const flexUsed = FLEX_ELIGIBLE.reduce((sum, pos) => {
    const have = starters.filter((r) => r.position === pos).length;
    const need = config[directSlotFor(pos)];
    return sum + Math.max(0, have - need);
  }, 0);
  fills.push({ slot: "FLEX", filled: Math.min(flexUsed, config.FLEX), required: config.FLEX });

  return fills.filter((f) => f.required > 0);
}

/**
 * Whether a newly-added player at `position` should default to starter
 * given the roster's current starters and the league's slot config. Order-
 * of-add heuristic (first in claims the slot) — good enough for a sane
 * default; "Auto-set lineup" (below) replaces it with the point-optimal
 * assignment once real projections are available.
 */
export function suggestStarterDefault(
  roster: RosterEntry[],
  position: RealPosition,
  config: LeagueConfig,
): boolean {
  const slot = directSlotFor(position);
  const directNeed = config[slot];
  const directHave = roster.filter((r) => r.starter && r.position === position).length;
  if (directHave < directNeed) return true;

  if (FLEX_ELIGIBLE.includes(position) && config.FLEX > 0) {
    const flexUsed = FLEX_ELIGIBLE.reduce((sum, pos) => {
      const have = roster.filter((r) => r.starter && r.position === pos).length;
      const need = config[directSlotFor(pos)];
      return sum + Math.max(0, have - need);
    }, 0);
    if (flexUsed < config.FLEX) return true;
  }

  return false;
}

function pointsFor(
  entry: RosterEntry,
  stats: Map<string, PlayerStat>,
  format: ScoringFormat,
): number {
  const s = stats.get(entry.id);
  return s ? projectPoints(s, format) : replacementBaseline(entry.position, format) * 0.9;
}

/**
 * The point-optimal starting lineup for this roster under this league's
 * slots: fills each direct slot with its best available players, then
 * fills FLEX from whoever's left over among RB/WR/TE. Returns the ids that
 * should start; everyone else is bench.
 */
export function suggestLineup(
  roster: RosterEntry[],
  stats: Map<string, PlayerStat>,
  config: LeagueConfig,
  format: ScoringFormat,
): string[] {
  const points = (e: RosterEntry) => pointsFor(e, stats, format);
  const used = new Set<string>();
  const starters: string[] = [];

  const directSlots: Array<[Exclude<SlotPosition, "FLEX">, RealPosition]> = [
    ["QB", "QB"],
    ["RB", "RB"],
    ["WR", "WR"],
    ["TE", "TE"],
    ["DST", "DEF"],
    ["K", "K"],
  ];

  for (const [slot, real] of directSlots) {
    const need = config[slot];
    if (need <= 0) continue;
    const pool = roster.filter((r) => r.position === real).sort((a, b) => points(b) - points(a));
    for (const r of pool.slice(0, need)) {
      starters.push(r.id);
      used.add(r.id);
    }
  }

  if (config.FLEX > 0) {
    const flexPool = roster
      .filter((r) => !used.has(r.id) && FLEX_ELIGIBLE.includes(r.position))
      .sort((a, b) => points(b) - points(a));
    for (const r of flexPool.slice(0, config.FLEX)) {
      starters.push(r.id);
      used.add(r.id);
    }
  }

  return starters;
}
