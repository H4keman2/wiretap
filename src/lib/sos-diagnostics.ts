/** Shared SOS diagnostics types (client-safe). */

export interface ProbeResult {
  label: string;
  url: string;
  status: number | null;
  ok: boolean;
  ms: number;
  note: string;
}

export interface UnmappedPlayer {
  id: string;
  name: string;
  position: string;
  team: string | null;
  reason: "no-nfl-team" | "team-not-in-schedule" | "no-matchups";
}

export interface SosDiagnostics {
  generatedAt: string;
  params: {
    seasonYear: number;
    standingsSeason: number;
    currentWeek: number;
    weeksRequested: number[];
    weekSource: "scoreboard" | "fallback";
  };
  probes: ProbeResult[];
  schedule: {
    teamsWithSos: number;
    teamsWithMatchups: number;
    sampleTeams: Array<{ team: string; grade: string; rating: number; matchups: number }>;
  };
  pool: {
    total: number;
    mapped: number;
    unmapped: number;
    unmappedByReason: Record<string, number>;
    unmappedSample: UnmappedPlayer[];
  };
}
