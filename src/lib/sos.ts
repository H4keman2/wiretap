/** Shared strength-of-schedule types (client-safe). */

export interface SosMatchup {
  week: number;
  opponent: string;
  home: boolean;
  /** 0-10, higher = tougher defense to face. */
  difficulty: number;
}

export interface TeamSos {
  team: string;
  /** 0-10 average difficulty across the upcoming window. */
  rating: number;
  grade: "A" | "B" | "C" | "D" | "F";
  label: "easy" | "favorable" | "neutral" | "tough" | "brutal";
  matchups: SosMatchup[];
}

/** Coverage health of the SOS pipeline (client-safe). */
export interface SosHealth {
  /** Teams that resolved to at least one upcoming matchup. */
  teamsWithMatchups: number;
  /** Minimum teams required before coverage counts as healthy. */
  threshold: number;
  /** True when coverage is below the threshold. */
  degraded: boolean;
  /** True when the next request will trigger a fresh ESPN probe. */
  willReprobe: boolean;
  lastProbeAt: string | null;
  lastError: string | null;
}
