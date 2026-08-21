import { createServerFn } from "@tanstack/react-start";

import {
  rankWaiverPool,
  type RankedPlayer,
  type ScoringFormat,
  type SlotPosition,
} from "./ranking";
import { analyzeRoster, type LeagueConfig, type PositionVerdict, type RosterEntry } from "./weakness";

export interface RecommendationInput {
  format: ScoringFormat;
  slot: SlotPosition;
  maxOwnership: number;
}

export const getRecommendations = createServerFn({ method: "GET" })
  .inputValidator((data: RecommendationInput) => data)
  .handler(async ({ data }): Promise<RankedPlayer[]> => {
    const { getPlayerPool } = await import("./sleeper.server");
    const pool = await getPlayerPool();
    return rankWaiverPool(pool, {
      format: data.format,
      slot: data.slot,
      maxOwnership: data.maxOwnership,
      limit: 5,
    });
  });

export const searchPlayers = createServerFn({ method: "GET" })
  .inputValidator((data: { query: string }) => data)
  .handler(
    async ({
      data,
    }): Promise<Array<{ id: string; name: string; team: string | null; position: string }>> => {
      const q = data.query.trim().toLowerCase();
      if (q.length < 2) return [];
      const { getPlayerPool } = await import("./sleeper.server");
      const pool = await getPlayerPool();
      return pool
        .filter((p) => p.name.toLowerCase().includes(q))
        .sort((a, b) => b.ownership - a.ownership)
        .slice(0, 8)
        .map((p) => ({ id: p.id, name: p.name, team: p.team, position: p.position }));
    },
  );

export interface AnalyzeInput {
  format: ScoringFormat;
  config: LeagueConfig;
  roster: RosterEntry[];
  maxOwnership: number;
  overrideSlot?: SlotPosition | null;
}

export interface AnalyzeOutput {
  verdicts: PositionVerdict[];
  targetSlot: SlotPosition;
  recommendations: RankedPlayer[];
}

export const analyzeTeam = createServerFn({ method: "POST" })
  .inputValidator((data: AnalyzeInput) => data)
  .handler(async ({ data }): Promise<AnalyzeOutput> => {
    const { getPlayerPool } = await import("./sleeper.server");
    const pool = await getPlayerPool();
    const stats = new Map(pool.map((p) => [p.id, p]));

    const verdicts = analyzeRoster(data.roster, stats, data.config, data.format);
    const targetSlot = data.overrideSlot ?? verdicts[0]?.slot ?? "RB";

    const rosterIds = new Set(data.roster.map((r) => r.id));
    const recommendations = rankWaiverPool(
      pool.filter((p) => !rosterIds.has(p.id)),
      { format: data.format, slot: targetSlot, maxOwnership: data.maxOwnership, limit: 5 },
    );

    return { verdicts, targetSlot, recommendations };
  });
