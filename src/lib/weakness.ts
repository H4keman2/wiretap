/**
 * Positional weakness scoring for the Team Analyzer.
 * Kept transparent on purpose: every score ships the reasons behind it.
 */

import {
  DEPTH_RISK,
  projectPoints,
  replacementBaseline,
  type PlayerStat,
  type RealPosition,
  type ScoringFormat,
  type SlotPosition,
} from "./ranking";

export interface LeagueConfig {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  FLEX: number;
  DST: number;
  K: number;
  bench: number;
}

export const DEFAULT_LEAGUE: LeagueConfig = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1,
  DST: 1,
  K: 1,
  bench: 6,
};

export interface RosterEntry {
  id: string;
  name: string;
  position: RealPosition;
  starter: boolean;
}

export interface PositionVerdict {
  slot: SlotPosition;
  /** 0-100. Lower means weaker. */
  score: number;
  starterPoints: number;
  baselinePoints: number;
  benchCount: number;
  missingStarters: number;
  reasons: string[];
}

const SLOT_TO_REAL: Record<Exclude<SlotPosition, "FLEX">, RealPosition> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  DST: "DEF",
  K: "K",
};

const FLEX_POSITIONS: RealPosition[] = ["RB", "WR", "TE"];

export function analyzeRoster(
  roster: RosterEntry[],
  stats: Map<string, PlayerStat>,
  config: LeagueConfig,
  format: ScoringFormat,
): PositionVerdict[] {
  const points = (e: RosterEntry) => {
    const s = stats.get(e.id);
    return s ? projectPoints(s, format) : replacementBaseline(e.position, format) * 0.9;
  };

  const verdicts: PositionVerdict[] = [];

  const slots: SlotPosition[] = ["QB", "RB", "WR", "TE", "FLEX", "DST", "K"];

  for (const slot of slots) {
    const required = config[slot];
    if (required <= 0) continue;

    const eligible: RealPosition[] =
      slot === "FLEX" ? FLEX_POSITIONS : [SLOT_TO_REAL[slot as Exclude<SlotPosition, "FLEX">]];

    const pool = roster.filter((e) => eligible.includes(e.position));
    const starters = pool
      .filter((e) => e.starter)
      .sort((a, b) => points(b) - points(a))
      .slice(0, required);
    const bench = pool.filter((e) => !e.starter);

    const starterPoints = starters.reduce((sum, e) => sum + points(e), 0);
    const baselinePoints = eligible.length
      ? required *
        (eligible.reduce((sum, p) => sum + replacementBaseline(p, format), 0) / eligible.length)
      : 0;

    const missingStarters = Math.max(0, required - starters.length);
    const risk = eligible.reduce((max, p) => Math.max(max, DEPTH_RISK[p]), 0);

    // Core signal: starting output versus replacement level.
    const ratio = baselinePoints > 0 ? starterPoints / baselinePoints : 1;
    let score = Math.min(100, ratio * 62);

    const reasons: string[] = [];
    reasons.push(
      `Starters project ${starterPoints.toFixed(1)} pts/week against a ${baselinePoints.toFixed(1)} replacement baseline (${Math.round(ratio * 100)}%).`,
    );

    if (missingStarters > 0) {
      score -= missingStarters * 28;
      reasons.push(
        `${missingStarters} starting ${slot} slot${missingStarters > 1 ? "s" : ""} unfilled — that is an automatic zero every week.`,
      );
    }

    // Bench depth, weighted by how costly injuries are at this position.
    const desiredBench = risk >= 0.8 ? 2 : risk >= 0.5 ? 1 : 0;
    const benchGap = Math.max(0, desiredBench - bench.length);
    if (benchGap > 0) {
      score -= benchGap * 12 * risk;
      reasons.push(
        `Only ${bench.length} bench body here, and ${slot} injuries are expensive to absorb.`,
      );
    } else if (bench.length > 0) {
      reasons.push(`${bench.length} bench option${bench.length > 1 ? "s" : ""} covering this spot.`);
    }

    verdicts.push({
      slot,
      score: Math.max(0, Math.round(score)),
      starterPoints: Math.round(starterPoints * 10) / 10,
      baselinePoints: Math.round(baselinePoints * 10) / 10,
      benchCount: bench.length,
      missingStarters,
      reasons,
    });
  }

  return verdicts.sort((a, b) => a.score - b.score);
}
