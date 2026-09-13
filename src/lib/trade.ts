/**
 * Two-player trade comparison. Pure logic, no UI and no fetching, so the
 * weighting can be tuned independently of the screen that renders it.
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

export function analyzeTrade(
  a: RankedPlayer,
  b: RankedPlayer,
  format: ScoringFormat,
): TradeAnalysis {
  const ppgA = pointsPerGame(a, format);
  const ppgB = pointsPerGame(b, format);
  const sosA = sosScore(a);
  const sosB = sosScore(b);
  const healthA = injuryFactor(a.injury);
  const healthB = injuryFactor(b.injury);

  const metrics: TradeMetric[] = [
    {
      label: "Weekly projection",
      aText: `${a.projection.toFixed(1)} pts`,
      bText: `${b.projection.toFixed(1)} pts`,
      winner: cmp(a.projection, b.projection, 0.4),
      hint: "Expected points this week in the selected scoring format.",
    },
    {
      label: "Wire Tap score",
      aText: `${a.score.toFixed(1)}/10`,
      bText: `${b.score.toFixed(1)}/10`,
      winner: cmp(a.score, b.score, 0.2),
      hint: "Overall recommendation strength: production, role, trend and matchups.",
    },
    {
      label: "Last season / game",
      aText: ppgA === null ? "—" : `${ppgA.toFixed(1)} pts`,
      bText: ppgB === null ? "—" : `${ppgB.toFixed(1)} pts`,
      winner: ppgA === null || ppgB === null ? 0 : cmp(ppgA, ppgB, 0.5),
      hint: "Proven production per game last season, scored in this format.",
    },
    {
      label: "Rostered %",
      aText: `${Math.round(a.ownership)}%`,
      bText: `${Math.round(b.ownership)}%`,
      winner: cmp(a.ownership, b.ownership, 2),
      hint: "How widely rostered — a proxy for how the rest of your league values him.",
    },
    {
      label: "24h adds",
      aText: a.addCount.toLocaleString(),
      bText: b.addCount.toLocaleString(),
      winner: cmp(a.trendDelta, b.trendDelta, 50),
      hint: "Momentum right now. A spike means his price is about to go up.",
    },
    {
      label: "Position rank",
      aText: `#${a.posRank} ${a.position}`,
      bText: `#${b.posRank} ${b.position}`,
      winner: cmp(-a.posRank, -b.posRank, 1),
      hint: "Standing within his own position by overall interest.",
    },
    {
      label: "Schedule",
      aText: a.sos ? `${a.sos.grade} grade` : "—",
      bText: b.sos ? `${b.sos.grade} grade` : "—",
      winner: sosA === null || sosB === null ? 0 : cmp(sosA, sosB),
      hint: "Difficulty of the next few matchups for his NFL team.",
    },
    {
      label: "Health",
      aText: a.injury ?? "Healthy",
      bText: b.injury ?? "Healthy",
      winner: cmp(healthA, healthB, 0.05),
      hint: "Current injury tag, and how much of his normal output to expect.",
    },
  ];

  // Weighted edge. Projection and proven production carry the trade; trend,
  // schedule and health nudge it.
  const projEdge = (b.projection - a.projection) * 1.0;
  const scoreEdge = (b.score - a.score) * 0.8;
  const ppgEdge = ppgA !== null && ppgB !== null ? (ppgB - ppgA) * 0.5 : 0;
  const trendEdge = Math.max(-1.5, Math.min(1.5, (b.trendDelta - a.trendDelta) / 800));
  const sosEdge = sosA !== null && sosB !== null ? (sosB - sosA) * 0.4 : 0;
  const healthEdge = (healthB - healthA) * 3;
  const edge = projEdge + scoreEdge + ppgEdge + trendEdge + sosEdge + healthEdge;

  const winner = edge > 0 ? b : a;
  const loser = edge > 0 ? a : b;
  const mag = Math.abs(edge);
  const side: TradeVerdict["side"] = mag < 1 ? "even" : edge > 0 ? "b" : "a";

  let headline: string;
  let detail: string;
  if (side === "even") {
    headline = "Close to even";
    detail = `${a.name} and ${b.name} grade out within a point of each other. Trade only if one fills a hole in your lineup — the raw value is a wash.`;
  } else {
    const strength = mag > 4 ? "clear" : mag > 2 ? "solid" : "slight";
    headline =
      mag > 4
        ? `${winner.name} wins this clearly`
        : mag > 2
          ? `${winner.name} is the better side`
          : `${winner.name} by a nose`;
    const reasons: string[] = [];
    if (Math.abs(winner.projection - loser.projection) > 0.4)
      reasons.push(
        `${(winner.projection - loser.projection).toFixed(1)} more projected points a week`,
      );
    if (ppgA !== null && ppgB !== null) {
      const wp = winner === a ? ppgA : ppgB;
      const lp = winner === a ? ppgB : ppgA;
      if (wp - lp > 0.5) reasons.push(`${(wp - lp).toFixed(1)} more points per game last season`);
    }
    if (loser.injury && !winner.injury) reasons.push(`${loser.name} is carrying a ${loser.injury} tag`);
    if (winner.sos && loser.sos && winner.sos.grade !== loser.sos.grade)
      reasons.push(`an easier upcoming slate (${winner.sos.grade} vs ${loser.sos.grade})`);
    if (reasons.length === 0) reasons.push("a stronger overall profile");
    detail = `A ${strength} edge for ${winner.name}: ${reasons.slice(0, 3).join(", ")}. If you're giving him up, ask for more back.`;
  }

  return { metrics, verdict: { edge, headline, detail, side } };
}
