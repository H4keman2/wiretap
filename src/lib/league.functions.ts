import { createServerFn } from "@tanstack/react-start";

import type { RealPosition, ScoringFormat } from "./ranking";
import type { LeagueConfig, RosterEntry } from "./weakness";

export interface LeagueCred {
  leagueId: string;
  espnS2?: string | null;
  swid?: string | null;
}

export interface LeagueTeamSummary {
  id: number;
  name: string;
  playerCount: number;
}

export interface LeagueSummary {
  leagueId: string;
  season: number;
  name: string;
  size: number;
  format: ScoringFormat;
  config: LeagueConfig;
  teams: LeagueTeamSummary[];
  faabBudget: number | null;
  /** How many distinct players are rostered across the whole league. */
  rosteredCount: number;
}

function friendly(err: unknown): Error {
  const message = err instanceof Error ? err.message : "Couldn't read that league.";
  return new Error(message);
}

/** Read a league's settings, size, and team list so the user can pick their team. */
export const connectLeague = createServerFn({ method: "POST" })
  .inputValidator((data: LeagueCred) => data)
  .handler(async ({ data }): Promise<LeagueSummary> => {
    const { getLeagueSnapshot } = await import("./espn-league.server");
    try {
      const snap = await getLeagueSnapshot(data);
      return {
        leagueId: snap.leagueId,
        season: snap.season,
        name: snap.name,
        size: snap.size,
        format: snap.format,
        config: snap.config,
        faabBudget: snap.faabBudget,
        rosteredCount: snap.rosteredKeys.length,
        teams: snap.teams.map((t) => ({
          id: t.id,
          name: t.name,
          playerCount: t.roster.length,
        })),
      };
    } catch (err) {
      throw friendly(err);
    }
  });

/** Pull one team's roster out of the league, ready to drop into the analyzer. */
export const importLeagueRoster = createServerFn({ method: "POST" })
  .inputValidator((data: LeagueCred & { teamId: number }) => data)
  .handler(async ({ data }): Promise<{ entries: RosterEntry[]; unmatched: string[] }> => {
    const { getLeagueSnapshot, playerKey } = await import("./espn-league.server");
    const { getPlayerPool } = await import("./players.server");

    try {
      const [snap, pool] = await Promise.all([getLeagueSnapshot(data), getPlayerPool()]);
      const team = snap.teams.find((t) => t.id === data.teamId);
      if (!team) throw new Error("That team isn't in the league any more.");

      const byKey = new Map(pool.map((p) => [playerKey(p.name, p.position), p]));
      const entries: RosterEntry[] = [];
      const unmatched: string[] = [];

      for (const p of team.roster) {
        const position: RealPosition = p.position ?? "RB";
        const match = p.position ? byKey.get(playerKey(p.name, p.position)) : undefined;
        if (!match) unmatched.push(p.name);
        entries.push({
          id: match?.id ?? `manual-${p.name.toLowerCase()}`,
          name: p.name,
          position: match?.position ?? position,
          starter: p.starter,
        });
      }

      return { entries, unmatched };
    } catch (err) {
      throw friendly(err);
    }
  });
