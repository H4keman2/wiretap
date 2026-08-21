/**
 * Waiver ranking engine.
 *
 * Deliberately isolated from the UI so the algorithm can be tuned
 * independently once real usage data comes in.
 */

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
}

export interface RankedPlayer extends PlayerStat {
  /** 0-10 recommendation strength. */
  score: number;
  projection: number;
  trendDelta: number;
  trendLabel: "rising" | "stable" | "falling";
  reason: string;
}

/** Reception value per catch by format. */
const RECEPTION_VALUE: Record<ScoringFormat, number> = { std: 0, half: 0.5, ppr: 1 };

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

/** Projected weekly fantasy points for a player in a given format. */
export function projectPoints(p: PlayerStat, format: ScoringFormat): number {
  let pts =
    baseProduction(p.position, p.posRank) +
    expectedReceptions(p.position, p.posRank) * RECEPTION_VALUE[format];

  if (p.depthOrder === 1) pts *= 1.12;
  else if (p.depthOrder && p.depthOrder >= 3) pts *= 0.82;

  if (p.injury) pts *= 0.7;

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

function buildReason(p: PlayerStat, format: ScoringFormat, projection: number): string {
  const bits: string[] = [];
  const { label } = trendOf(p);

  if (p.depthOrder === 1) bits.push(`listed first on the ${p.team ?? "team"} depth chart`);
  else if (p.depthOrder === 2) bits.push("next man up in the rotation");

  if (label === "rising") bits.push("being added fast across leagues this week");
  else if (label === "falling") bits.push("cooling off in adds, buy-low window");

  if (format !== "std" && (p.position === "WR" || p.position === "TE" || p.position === "RB")) {
    bits.push("reception volume plays up in your format");
  }

  if (p.injury) bits.push(`carrying a ${p.injury.toLowerCase()} tag, confirm status first`);

  const lead = `Projects around ${projection.toFixed(1)} pts/week at ${Math.round(p.ownership)}% rostered`;
  if (bits.length === 0) return `${lead}. Straight depth add with startable upside if the room thins out.`;
  return `${lead} — ${bits.slice(0, 2).join(", and ")}.`;
}

/** Score a single player 0-10 by projection, trend, and opportunity. */
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

  const raw = vor * 0.5 + trend * 0.3 + opportunity * 0.2;

  return {
    ...p,
    projection,
    trendDelta: delta,
    trendLabel: label,
    score: Math.round(Math.min(10, raw * 10.5) * 10) / 10,
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

/** Filter the eligible pool by availability, then rank it. */
export function rankWaiverPool(pool: PlayerStat[], opts: RankOptions): RankedPlayer[] {
  const { format, slot, maxOwnership, limit = 5 } = opts;
  return pool
    .filter((p) => positionMatches(p, slot) && p.ownership < maxOwnership)
    .map((p) => scorePlayer(p, format))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
