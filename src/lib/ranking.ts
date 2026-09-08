/**
 * Waiver ranking engine.
 *
 * Deliberately isolated from the UI so the algorithm can be tuned
 * independently once real usage data comes in.
 */

import { seasonFantasyPoints, type SeasonStats } from "./season-stats";
import type { TeamSos } from "./sos";

export type ScoringFormat = "std" | "half" | "ppr";

export type SlotPosition = "QB" | "RB" | "WR" | "TE" | "FLEX" | "DST" | "K";
export type RealPosition = "QB" | "RB" | "WR" | "TE" | "DEF" | "K";

export const SLOT_POSITIONS: SlotPosition[] = ["QB", "RB", "WR", "TE", "FLEX", "DST", "K"];
export const REAL_POSITIONS: RealPosition[] = ["QB", "RB", "WR", "TE", "DEF", "K"];

export const FORMAT_LABEL: Record<ScoringFormat, string> = {
  std: "Standard",
  half: "Half-PPR",
  ppr: "Full PPR",
};

export interface PlayerStat {
  id: string;
  name: string;
  team: string | null;
  position: RealPosition;
  /** Estimated share of leagues rostering the player (proxy, 0-100). */
  ownership: number;
  /** Sleeper trending adds over the last 24h. */
  addCount: number;
  dropCount: number;
  /** Depth chart order (1 = starter) when known. */
  depthOrder: number | null;
  /** Rank within the player's own position by overall interest. */
  posRank: number;
  injury: string | null;
  /** Real % of leagues starting the player (ESPN), when available. */
  startedPct?: number | null;
  /** Week-over-week change in rostered % (ESPN). */
  ownershipChange?: number | null;
  /** Average draft position (ESPN), when available. */
  adp?: number | null;
  /** Where the rostered % came from. */
  ownershipSource?: "espn" | "estimate";
  /** Upcoming strength of schedule for the player's NFL team. */
  sos?: TeamSos | null;
  /** Most recent completed season's production (ESPN), when available. */
  lastSeason?: SeasonStats | null;
}

export interface RankedPlayer extends PlayerStat {
  /** 0-10 recommendation strength. */
  score: number;
  projection: number;
  trendDelta: number;
  trendLabel: "rising" | "stable" | "falling";
  reason: string;
  /**
   * Name of the rostered starter this player is the direct handcuff for,
   * when the caller has roster context (Team Analyzer only). Undefined
   * outside that context, never a signal that no handcuff exists.
   */
  handcuffOf?: string | null;
}

/** Reception value per catch by format. */
const RECEPTION_VALUE: Record<ScoringFormat, number> = { std: 0, half: 0.5, ppr: 1 };

/**
 * How much of a player's normal weekly output to expect given a Sleeper
 * injury tag. These are Sleeper's own vocabulary (Questionable/Doubtful/Out/
 * IR/PUP/Suspended/NA, occasionally others). A flat 30% haircut for every
 * tag treated "Out" and "Questionable" as equally risky, which understated
 * genuinely healthy-ish questionable players and overstated hurt ones who
 * are effectively droppable that week.
 */
const INJURY_MULTIPLIER: Record<string, number> = {
  Questionable: 0.88,
  Doubtful: 0.45,
  Out: 0.15,
  IR: 0.05,
  PUP: 0.05,
  NA: 0.15,
  Suspended: 0.05,
  COV: 0.4,
};

/** Expected fraction of normal output this week given an injury tag (1 = fully healthy). */
export function injuryFactor(injury: string | null | undefined): number {
  if (!injury) return 1;
  return INJURY_MULTIPLIER[injury] ?? 0.75;
}

/** Rough weekly receptions expected at a given positional rank. */
function expectedReceptions(position: RealPosition, posRank: number): number {
  if (position === "WR") return Math.max(1.2, 6.5 - posRank * 0.045);
  if (position === "RB") return Math.max(0.8, 4.2 - posRank * 0.03);
  if (position === "TE") return Math.max(0.8, 5 - posRank * 0.05);
  return 0;
}

/** Base non-reception weekly points expected at a given positional rank. */
function baseProduction(position: RealPosition, posRank: number): number {
  switch (position) {
    case "QB":
      return Math.max(6, 24 - posRank * 0.42);
    case "RB":
      return Math.max(3, 15 - posRank * 0.16);
    case "WR":
      return Math.max(2.5, 13 - posRank * 0.1);
    case "TE":
      return Math.max(2, 9 - posRank * 0.12);
    case "K":
      return Math.max(4, 10 - posRank * 0.12);
    case "DEF":
      return Math.max(3, 10 - posRank * 0.2);
  }
}

/**
 * How much of a player's prior-season value came from catching the ball.
 * 0 = pure runner / thrower, 1 = reception-dependent. null when unknown.
 */
export function receptionShare(p: PlayerStat): number | null {
  const s = p.lastSeason;
  if (!s || s.games < 4) return null;
  const recValue = s.recYds / 10 + s.recTd * 6 + s.receptions;
  const rushPassValue =
    s.rushYds / 10 + s.rushTd * 6 + s.passYds / 25 + s.passTd * 4 - s.interceptions * 2;
  const total = recValue + Math.max(0, rushPassValue);
  if (total <= 0) return null;
  return clamp01(recValue / total);
}

/** Projected weekly fantasy points for a player in a given format. */
export function projectPoints(p: PlayerStat, format: ScoringFormat): number {
  const model =
    baseProduction(p.position, p.posRank) +
    expectedReceptions(p.position, p.posRank) * RECEPTION_VALUE[format];

  // Blend the model with prior-season production scored in THIS format, so
  // pass-catching backs rise in PPR and pure runners hold value in standard.
  const s = p.lastSeason;
  let pts = model;
  if (s && s.games >= 4) {
    const actual = seasonFantasyPoints(s, format) / s.games;
    pts = model * 0.55 + actual * 0.45;
  }

  if (p.depthOrder === 1) pts *= 1.12;
  else if (p.depthOrder && p.depthOrder >= 3) pts *= 0.82;

  pts *= injuryFactor(p.injury);

  return Math.round(pts * 10) / 10;
}

/** Replacement-level weekly output — the "anyone can get this" baseline. */
export function replacementBaseline(position: RealPosition, format: ScoringFormat): number {
  const rec = RECEPTION_VALUE[format];
  switch (position) {
    case "QB":
      return 14;
    case "RB":
      return 7.5 + rec * 2.6;
    case "WR":
      return 7.8 + rec * 3.4;
    case "TE":
      return 5.4 + rec * 2.8;
    case "K":
      return 7;
    case "DEF":
      return 6;
  }
}

/** How costly it is to be thin at a position (bench-depth risk weight). */
export const DEPTH_RISK: Record<RealPosition, number> = {
  RB: 1,
  WR: 0.85,
  TE: 0.6,
  QB: 0.5,
  DEF: 0.3,
  K: 0.2,
};

function trendOf(p: PlayerStat) {
  const delta = p.addCount - p.dropCount;
  const label: RankedPlayer["trendLabel"] =
    delta > 400 ? "rising" : delta < -400 ? "falling" : "stable";
  return { delta, label };
}

/** How well a player's profile fits the selected scoring format (-1..1). */
export function formatFit(p: PlayerStat, format: ScoringFormat): number {
  const share = receptionShare(p);
  if (share === null) {
    if (format === "std") return 0;
    return p.position === "WR" || p.position === "TE" ? 0.15 : 0;
  }
  // Neutral profile ~0.5 reception-dependency.
  const lean = (share - 0.5) * 2; // -1 (pure runner) .. 1 (pure receiver)
  const formatWeight = format === "ppr" ? 1 : format === "half" ? 0.4 : -0.8;
  return clamp(lean * formatWeight, -1, 1);
}

function buildReason(p: PlayerStat, format: ScoringFormat, projection: number): string {
  const bits: string[] = [];
  const { label } = trendOf(p);
  const fit = formatFit(p, format);

  if (p.depthOrder === 1) bits.push(`listed first on the ${p.team ?? "team"} depth chart`);
  else if (p.depthOrder === 2) bits.push("next man up in the rotation");

  if (label === "rising") bits.push("being added fast across leagues this week");
  else if (label === "falling") bits.push("cooling off in adds, buy-low window");

  if (fit > 0.2) bits.push(`reception volume plays up in ${FORMAT_LABEL[format]}`);
  else if (fit < -0.2) bits.push(`carries and touchdowns travel well in ${FORMAT_LABEL[format]}`);

  if (p.injury) {
    const f = injuryFactor(p.injury);
    if (f <= 0.2) bits.push(`tagged ${p.injury} — treat as unlikely to play this week`);
    else if (f <= 0.5) bits.push(`tagged ${p.injury} — real chance he sits, have a plan B`);
    else bits.push(`carrying a ${p.injury.toLowerCase()} tag, confirm status before kickoff`);
  }

  const lead = `Projects around ${projection.toFixed(1)} pts/week at ${Math.round(p.ownership)}% rostered`;
  if (bits.length === 0)
    return `${lead}. Straight depth add with startable upside if the room thins out.`;
  return `${lead} — ${bits.slice(0, 2).join(", and ")}.`;
}

/** Score a single player 0-10 by projection, trend, opportunity, and format fit. */
export function scorePlayer(p: PlayerStat, format: ScoringFormat): RankedPlayer {
  const projection = projectPoints(p, format);
  const baseline = replacementBaseline(p.position, format);

  // Value over replacement, normalised to 0-1.
  const vor = clamp01((projection - baseline * 0.6) / (baseline * 0.9));

  // Trend: rostered % moving up is a buy signal.
  const { delta, label } = trendOf(p);
  const trend = clamp01(Math.log10(Math.max(1, p.addCount)) / 5 + delta / 20000);

  // Opportunity: depth chart position stands in for snap/target share.
  const opportunity = clamp01(
    p.depthOrder === null ? 0.45 : p.depthOrder === 1 ? 1 : p.depthOrder === 2 ? 0.65 : 0.3,
  );

  // Format fit nudges reception-heavy profiles up in PPR and runners up in standard.
  const fit = clamp01(0.5 + formatFit(p, format) * 0.5);

  const raw = vor * 0.42 + trend * 0.26 + opportunity * 0.17 + fit * 0.15;

  return {
    ...p,
    projection,
    trendDelta: delta,
    trendLabel: label,
    // Curve so realistic waiver-tier scores spread across a readable 3-9 band.
    score: Math.round(Math.min(10, Math.pow(raw, 0.75) * 13) * 10) / 10,

    reason: buildReason(p, format, projection),
  };
}

export function positionMatches(p: PlayerStat, slot: SlotPosition): boolean {
  if (slot === "FLEX") return p.position === "RB" || p.position === "WR" || p.position === "TE";
  if (slot === "DST") return p.position === "DEF";
  return p.position === slot;
}

export interface RankOptions {
  format: ScoringFormat;
  slot: SlotPosition;
  maxOwnership: number;
  limit?: number;
}

/**
 * Hard ceiling on how many ranked players a single call can return,
 * regardless of what a caller asks for. The UI used to hardcode `limit: 5`
 * ("Top 5") — this is not that; it's a sanity backstop so a pathological
 * request (FLEX at an 80% threshold pulls from three real positions at
 * once) can't return an unbounded array. No normal position-and-threshold
 * combination gets anywhere near it.
 */
const MAX_RANKED_RESULTS = 200;

/** Filter the eligible pool by availability, then rank all of it. */
export function rankWaiverPool(pool: PlayerStat[], opts: RankOptions): RankedPlayer[] {
  const { format, slot, maxOwnership, limit = MAX_RANKED_RESULTS } = opts;
  return pool
    .filter((p) => positionMatches(p, slot) && p.ownership < maxOwnership)
    .map((p) => scorePlayer(p, format))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(limit, MAX_RANKED_RESULTS));
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
