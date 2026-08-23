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
