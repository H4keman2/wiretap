/**
 * Starting-lineup injury alerts.
 *
 * Scans the players the user has flagged as starters, finds anyone carrying
 * an injury tag, and recommends the best legal substitution: first from the
 * bench (free, instant), then from the wire if the bench has nothing
 * playable at that spot.
 */

import { FLEX_ELIGIBLE, directSlotFor } from "./lineup";
import {
  injuryFactor,
  projectPoints,
  type PlayerStat,
  type RealPosition,
  type ScoringFormat,
} from "./ranking";
import type { LeagueConfig, RosterEntry } from "./weakness";

export type InjurySeverity = "out" | "doubtful" | "questionable";

export interface SubOption {
  id: string;
  name: string;
  team: string | null;
  position: RealPosition;
  projection: number;
  ownership: number;
  injury: string | null;
  source: "bench" | "wire";
}

export interface InjuryAlert {
  playerId: string;
  playerName: string;
  team: string | null;
  position: RealPosition;
  injury: string;
  severity: InjurySeverity;
  /** Fraction of normal output we expect this week (1 = fully healthy). */
  playFactor: number;
  /** One-line verdict, e.g. "Out — replace him before kickoff." */
  verdict: string;
  /** Best replacement overall (bench preferred), or null when nothing is playable. */
  best: SubOption | null;
  options: SubOption[];
}

function severityOf(factor: number): InjurySeverity {
  if (factor <= 0.2) return "out";
  if (factor <= 0.55) return "doubtful";
  return "questionable";
}

function verdictFor(severity: InjurySeverity, injury: string, name: string): string {
  const first = name.split(" ")[0] ?? name;
  if (severity === "out")
    return `${injury} — ${first} is not expected to play. Start someone else this week.`;
  if (severity === "doubtful")
    return `${injury} — real chance ${first} sits. Line up a replacement now.`;
  return `${injury} — ${first} should play, but confirm his status before kickoff.`;
}

/** Whether `candidate` can legally fill the slot the injured player occupies. */
function eligible(
  candidate: RealPosition,
  injured: RealPosition,
  config: LeagueConfig,
): boolean {
  if (candidate === injured) return true;
  return (
    config.FLEX > 0 && FLEX_ELIGIBLE.includes(injured) && FLEX_ELIGIBLE.includes(candidate)
  );
}

function toOption(
  p: PlayerStat,
  format: ScoringFormat,
  source: SubOption["source"],
): SubOption {
  return {
    id: p.id,
    name: p.name,
    team: p.team,
    position: p.position,
    projection: Math.round(projectPoints(p, format) * 10) / 10,
    ownership: Math.round(p.ownership),
    injury: p.injury,
    source,
  };
}

/** Injury tag is mild enough that we'd be comfortable starting the player. */
function playable(p: PlayerStat): boolean {
  return injuryFactor(p.injury) >= 0.75;
}

export function findInjuredStarters(
  roster: RosterEntry[],
  stats: Map<string, PlayerStat>,
  pool: PlayerStat[],
  config: LeagueConfig,
  format: ScoringFormat,
  maxWireOwnership = 80,
): InjuryAlert[] {
  const rosterIds = new Set(roster.map((r) => r.id));
  const starterIds = new Set(roster.filter((r) => r.starter).map((r) => r.id));
  const alerts: InjuryAlert[] = [];

  for (const entry of roster) {
    if (!entry.starter) continue;
    const s = stats.get(entry.id);
    const injury = s?.injury;
    if (!injury) continue;
    const factor = injuryFactor(injury);
    if (factor >= 1) continue;
    // Nothing to warn about when the position isn't even in the lineup.
    if (config[directSlotFor(entry.position)] <= 0 && !FLEX_ELIGIBLE.includes(entry.position))
      continue;

    const bench = roster
      .filter(
        (r) =>
          !starterIds.has(r.id) &&
          r.id !== entry.id &&
          eligible(r.position, entry.position, config),
      )
      .map((r) => stats.get(r.id))
      .filter((p): p is PlayerStat => !!p && playable(p))
      .map((p) => toOption(p, format, "bench"));

    const wire = pool
      .filter(
        (p) =>
          !rosterIds.has(p.id) &&
          p.ownership <= maxWireOwnership &&
          playable(p) &&
          eligible(p.position, entry.position, config),
      )
      .map((p) => toOption(p, format, "wire"))
      .sort((a, b) => b.projection - a.projection)
      .slice(0, 3);

    bench.sort((a, b) => b.projection - a.projection);
    const options = [...bench.slice(0, 3), ...(bench.length > 0 ? wire.slice(0, 2) : wire)];

    alerts.push({
      playerId: entry.id,
      playerName: entry.name,
      team: s?.team ?? null,
      position: entry.position,
      injury,
      severity: severityOf(factor),
      playFactor: factor,
      verdict: verdictFor(severityOf(factor), injury, entry.name),
      best: options[0] ?? null,
      options,
    });
  }

  const order: Record<InjurySeverity, number> = { out: 0, doubtful: 1, questionable: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}
