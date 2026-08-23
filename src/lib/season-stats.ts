/**
 * Prior-season production, shared between the server adapters and the UI.
 */

import type { ScoringFormat } from "./ranking";

export interface SeasonStats {
  season: number;
  games: number;
  passYds: number;
  passTd: number;
  interceptions: number;
  rushAtt: number;
  rushYds: number;
  rushTd: number;
  targets: number;
  receptions: number;
  recYds: number;
  recTd: number;
}

const RECEPTION_VALUE: Record<ScoringFormat, number> = { std: 0, half: 0.5, ppr: 1 };

/** Fantasy points scored last season under the selected format. */
export function seasonFantasyPoints(s: SeasonStats, format: ScoringFormat): number {
  const pts =
    s.passYds / 25 +
    s.passTd * 4 -
    s.interceptions * 2 +
    s.rushYds / 10 +
    s.rushTd * 6 +
    s.recYds / 10 +
    s.recTd * 6 +
    s.receptions * RECEPTION_VALUE[format];
  return Math.round(pts * 10) / 10;
}

export function perGame(total: number, games: number): number {
  if (games <= 0) return 0;
  return Math.round((total / games) * 10) / 10;
}
