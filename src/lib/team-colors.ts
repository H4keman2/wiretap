/**
 * NFL team brand colors keyed by Sleeper team abbreviation.
 * Used to tint player cards with a per-team highlight glow.
 */

export const TEAM_COLORS: Record<string, string> = {
  ARI: "#97233F",
  ATL: "#A71930",
  BAL: "#241773",
  BUF: "#00338D",
  CAR: "#0085CA",
  CHI: "#0B162A",
  CIN: "#FB4F14",
  CLE: "#311D00",
  DAL: "#003594",
  DEN: "#FB4F14",
  DET: "#0076B6",
  GB: "#203731",
  HOU: "#03202F",
  IND: "#002C5F",
  JAX: "#101820",
  KC: "#E31837",
  LV: "#000000",
  LAC: "#0080C6",
  LAR: "#003594",
  MIA: "#008E97",
  MIN: "#4F2683",
  NE: "#002244",
  NO: "#D3BC8D",
  NYG: "#0B2265",
  NYJ: "#125740",
  PHI: "#004C54",
  PIT: "#FFB612",
  SF: "#AA0000",
  SEA: "#002244",
  TB: "#D50A0A",
  TEN: "#0C2340",
  WAS: "#5A1414",
};

/** Returns a usable brand color or a neutral fallback for FA / unknown teams. */
export function teamColor(team: string | null | undefined): string {
  if (!team) return "#64748b";
  return TEAM_COLORS[team] ?? "#64748b";
}
