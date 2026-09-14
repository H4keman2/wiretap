/**
 * Trade comparison for one-for-one or multi-player packages. Pure logic, no UI
 * and no fetching, so the weighting can be tuned independently of the screen
 * that renders it.
 */

import { injuryFactor, type RankedPlayer, type ScoringFormat } from "./ranking";
import { perGame, seasonFantasyPoints } from "./season-stats";

export interface TradeMetric {
  label: string;
  /** Formatted values for display. */
  aText: string;
  bText: string;
  /** -1 = A better, 1 = B better, 0 = even / unknown. */
  winner: -1 | 0 | 1;
  hint: string;
}

export interface TradeVerdict {
  /** Positive = side B wins the trade, negative = side A wins. */
  edge: number;
  headline: string;
  detail: string;
  /** "a" | "b" | "even" — who comes out ahead. */
  side: "a" | "b" | "even";
}

export interface TradeAnalysis {
  metrics: TradeMetric[];
  verdict: TradeVerdict;
}

function cmp(a: number, b: number, tolerance = 0): -1 | 0 | 1 {
  if (Math.abs(a - b) <= tolerance) return 0;
  return a > b ? -1 : 1;
}

const SOS_VALUE: Record<string, number> = { A: 2, B: 1, C: 0, D: -1, F: -2 };

function sosScore(p: RankedPlayer): number | null {
  const g = p.sos?.grade;
  return g ? (SOS_VALUE[g] ?? 0) : null;
}

function pointsPerGame(p: RankedPlayer, format: ScoringFormat): number | null {
  const s = p.lastSeason;
  if (!s || s.games <= 0) return null;
  return perGame(seasonFantasyPoints(s, format), s.games);
}

function sum(values: number[]): number {
  return values.reduce((t, v) => t + v, 0);
}

function avg(values: number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

function avgOrNull(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null);
  return known.length === 0 ? null : sum(known) / known.length;
}

interface SideTotals {
  players: RankedPlayer[];
  label: string;
  count: number;
  /** Combined weekly projection of the whole package. */
  projection: number;
  /** Value of the single best piece — what actually starts for you. */
  bestProjection: number;
  bestName: string;
  score: number;
  ppg: number | null;
  ownership: number;
  adds: number;
  trendDelta: number;
  sos: number | null;
  health: number;
  injured: RankedPlayer[];
}

function sideName(players: RankedPlayer[]): string {
  if (players.length === 0) return "—";
  if (players.length === 1) return players[0]!.name;
  if (players.length === 2) return `${players[0]!.name} + ${players[1]!.name}`;
  return `${players[0]!.name} + ${players.length - 1} more`;
}

function totals(players: RankedPlayer[], format: ScoringFormat): SideTotals {
  const best = players.reduce<RankedPlayer | null>(
    (b, p) => (b === null || p.projection > b.projection ? p : b),
    null,
  );
  return {
    players,
    label: sideName(players),
    count: players.length,
    projection: sum(players.map((p) => p.projection)),
    bestProjection: best?.projection ?? 0,
    bestName: best?.name ?? "—",
    score: avg(players.map((p) => p.score)),
    ppg: avgOrNull(players.map((p) => pointsPerGame(p, format))),
    ownership: avg(players.map((p) => p.ownership)),
    adds: sum(players.map((p) => p.addCount)),
    trendDelta: sum(players.map((p) => p.trendDelta)),
    sos: avgOrNull(players.map((p) => sosScore(p))),
    health: avg(players.map((p) => injuryFactor(p.injury))),
    injured: players.filter((p) => !!p.injury),
  };
}

function positionSummary(players: RankedPlayer[]): string {
  const counts = new Map<string, number>();
  for (const p of players) counts.set(p.position, (counts.get(p.position) ?? 0) + 1);
  return [...counts.entries()].map(([pos, n]) => (n > 1 ? `${n}× ${pos}` : pos)).join(", ");
}

export function analyzeTrade(
  sideA: RankedPlayer[],
  sideB: RankedPlayer[],
  format: ScoringFormat,
): TradeAnalysis {
  const A = totals(sideA, format);
  const B = totals(sideB, format);

  const metrics: TradeMetric[] = [
    {
      label: "Players",
      aText: positionSummary(sideA) || "—",
      bText: positionSummary(sideB) || "—",
      winner: 0,
      hint: "What each side is sending, by position.",
    },
    {
      label: "Combined projection",
      aText: `${A.projection.toFixed(1)} pts`,
      bText: `${B.projection.toFixed(1)} pts`,
      winner: cmp(A.projection, B.projection, 0.4),
      hint: "Total expected points this week across every player on that side.",
    },
    {
      label: "Best single piece",
      aText: `${A.bestProjection.toFixed(1)} pts`,
      bText: `${B.bestProjection.toFixed(1)} pts`,
      winner: cmp(A.bestProjection, B.bestProjection, 0.4),
      hint: "The top player in the package — depth is worth less than a starter.",
    },
    {
      label: "Avg Wire Tap score",
      aText: `${A.score.toFixed(1)}/10`,
      bText: `${B.score.toFixed(1)}/10`,
      winner: cmp(A.score, B.score, 0.2),
      hint: "Average recommendation strength: production, role, trend and matchups.",
    },
    {
      label: "Last season / game",
      aText: A.ppg === null ? "—" : `${A.ppg.toFixed(1)} pts`,
      bText: B.ppg === null ? "—" : `${B.ppg.toFixed(1)} pts`,
      winner: A.ppg === null || B.ppg === null ? 0 : cmp(A.ppg, B.ppg, 0.5),
      hint: "Average proven production per game last season, scored in this format.",
    },
    {
      label: "Avg rostered %",
      aText: `${Math.round(A.ownership)}%`,
      bText: `${Math.round(B.ownership)}%`,
      winner: cmp(A.ownership, B.ownership, 2),
      hint: "How widely rostered — a proxy for how the rest of your league values them.",
    },
    {
      label: "24h adds",
      aText: A.adds.toLocaleString(),
      bText: B.adds.toLocaleString(),
      winner: cmp(A.trendDelta, B.trendDelta, 50),
      hint: "Momentum right now. A spike means their price is about to go up.",
    },
    {
      label: "Schedule",
      aText: A.sos === null ? "—" : A.sos.toFixed(1),
      bText: B.sos === null ? "—" : B.sos.toFixed(1),
      winner: A.sos === null || B.sos === null ? 0 : cmp(A.sos, B.sos, 0.2),
      hint: "Average schedule difficulty score for the next few weeks (higher is easier).",
    },
    {
      label: "Health",
      aText: A.injured.length === 0 ? "All healthy" : `${A.injured.length} tagged`,
      bText: B.injured.length === 0 ? "All healthy" : `${B.injured.length} tagged`,
      winner: cmp(A.health, B.health, 0.05),
      hint: "How many players carry an injury tag, and how much output to expect.",
    },
  ];

  // Weighted edge. The best starter and combined output carry the trade; trend,
  // schedule, health and roster-spot cost nudge it.
  const projEdge = (B.projection - A.projection) * 0.7;
  const bestEdge = (B.bestProjection - A.bestProjection) * 0.6;
  const scoreEdge = (B.score - A.score) * 0.8;
  const ppgEdge = A.ppg !== null && B.ppg !== null ? (B.ppg - A.ppg) * 0.5 : 0;
  const trendEdge = Math.max(-1.5, Math.min(1.5, (B.trendDelta - A.trendDelta) / 800));
  const sosEdge = A.sos !== null && B.sos !== null ? (B.sos - A.sos) * 0.4 : 0;
  const healthEdge = (B.health - A.health) * 3;
  // Every extra body you take back costs a bench spot.
  const spotEdge = (A.count - B.count) * 0.5;
  const edge =
    projEdge + bestEdge + scoreEdge + ppgEdge + trendEdge + sosEdge + healthEdge + spotEdge;

  const winner = edge > 0 ? B : A;
  const loser = edge > 0 ? A : B;
  const mag = Math.abs(edge);
  const side: TradeVerdict["side"] = mag < 1 ? "even" : edge > 0 ? "b" : "a";

  let headline: string;
  let detail: string;
  if (side === "even") {
    headline = "Close to even";
    detail = `${A.label} and ${B.label} grade out within a point of each other. Trade only if one side fills a hole in your lineup — the raw value is a wash.`;
  } else {
    const strength = mag > 4 ? "clear" : mag > 2 ? "solid" : "slight";
    headline =
      mag > 4
        ? `${winner.label} wins this clearly`
        : mag > 2
          ? `${winner.label} is the better side`
          : `${winner.label} by a nose`;
    const reasons: string[] = [];
    if (Math.abs(winner.projection - loser.projection) > 0.4)
      reasons.push(
        `${(winner.projection - loser.projection).toFixed(1)} more projected points a week`,
      );
    if (winner.bestProjection - loser.bestProjection > 0.4)
      reasons.push(`the best player in the deal (${winner.bestName})`);
    if (winner.ppg !== null && loser.ppg !== null && winner.ppg - loser.ppg > 0.5)
      reasons.push(`${(winner.ppg - loser.ppg).toFixed(1)} more points per game last season`);
    if (loser.injured.length > winner.injured.length)
      reasons.push(
        `${loser.injured.length} injury tag${loser.injured.length === 1 ? "" : "s"} on the other side`,
      );
    if (winner.count < loser.count)
      reasons.push(`fewer bodies to roster (${winner.count} vs ${loser.count})`);
    if (reasons.length === 0) reasons.push("a stronger overall profile");
    detail = `A ${strength} edge for ${winner.label}: ${reasons.slice(0, 3).join(", ")}. If you're giving that side up, ask for more back.`;
  }

  return { metrics, verdict: { edge, headline, detail, side } };
}
