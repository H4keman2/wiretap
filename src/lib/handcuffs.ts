/**
 * Handcuff detection.
 *
 * A "handcuff" is the very next player on the depth chart behind a player
 * already on the roster, at the same team and position — the classic
 * insurance pickup, since losing a lead back (or QB1, or a WR1 in a
 * concentrated passing game) to injury is common and the backup often has
 * value only for that team's own fantasy manager, which keeps it available
 * on the wire longer than its eventual upside deserves.
 */

import type { PlayerStat, RealPosition } from "./ranking";
import type { RosterEntry } from "./weakness";

export interface HandcuffSuggestion {
  starterId: string;
  starterName: string;
  handcuff: PlayerStat;
  reason: string;
}

/** K and DEF don't have a meaningful "backup" in fantasy terms. */
const HANDCUFF_POSITIONS: RealPosition[] = ["RB", "WR", "TE", "QB"];

/**
 * For each rostered starter we can place on a real NFL depth chart, find
 * the next player behind them at the same team/position who isn't already
 * on the roster.
 */
export function findHandcuffs(roster: RosterEntry[], pool: PlayerStat[]): HandcuffSuggestion[] {
  const stats = new Map(pool.map((p) => [p.id, p]));
  const rosterIds = new Set(roster.map((r) => r.id));

  const byTeamPos = new Map<string, PlayerStat[]>();
  for (const p of pool) {
    if (!p.team || !HANDCUFF_POSITIONS.includes(p.position)) continue;
    const k = `${p.team}|${p.position}`;
    const list = byTeamPos.get(k) ?? [];
    list.push(p);
    byTeamPos.set(k, list);
  }
  for (const list of byTeamPos.values()) {
    list.sort((a, b) => (a.depthOrder ?? 99) - (b.depthOrder ?? 99));
  }

  const out: HandcuffSuggestion[] = [];
  for (const entry of roster) {
    if (!entry.starter) continue;
    const s = stats.get(entry.id);
    if (!s?.team || s.depthOrder == null) continue;
    if (!HANDCUFF_POSITIONS.includes(s.position)) continue;

    const list = byTeamPos.get(`${s.team}|${s.position}`) ?? [];
    const next = list.find(
      (p) => (p.depthOrder ?? 99) === s.depthOrder! + 1 && !rosterIds.has(p.id),
    );
    if (!next) continue;

    out.push({
      starterId: entry.id,
      starterName: entry.name,
      handcuff: next,
      reason: `Backs up ${entry.name} directly on ${s.team} — steps into the lead role if ${entry.name} misses time.`,
    });
  }

  return out;
}
