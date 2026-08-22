/**
 * Unified player pool.
 *
 * Sleeper  -> player identity, NFL team, depth chart order, injury tag,
 *             24h trending adds/drops across leagues.
 * ESPN     -> real league-wide rostered %, started %, week-over-week
 *             ownership change, and ADP.
 *
 * ESPN ownership overrides Sleeper's interest-rank estimate wherever the two
 * sources can be matched by name + position; anything ESPN doesn't cover keeps
 * the Sleeper-derived estimate and is flagged as such.
 */

import { fetchEspnPlayers, type EspnPlayer } from "./espn.server";
import type { PlayerStat } from "./ranking";
import { getSleeperPool } from "./sleeper.server";

const TTL_MS = 1000 * 60 * 60 * 6;

let cache: { at: number; pool: PlayerStat[] } | null = null;
let inflight: Promise<PlayerStat[]> | null = null;

const SUFFIX = /\s+(jr|sr|ii|iii|iv|v)\.?$/i;

function key(name: string, position: string): string {
  const clean = name
    .toLowerCase()
    .replace(/[.'`’-]/g, "")
    .replace(SUFFIX, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${clean}|${position}`;
}

async function build(): Promise<PlayerStat[]> {
  const [sleeper, espn] = await Promise.all([
    getSleeperPool(),
    fetchEspnPlayers().catch((): EspnPlayer[] => []),
  ]);

  const espnByKey = new Map(espn.map((p) => [key(p.name, p.position), p]));

  const merged: PlayerStat[] = sleeper.map((p) => {
    const match = espnByKey.get(key(p.name, p.position));
    if (!match) return { ...p, ownershipSource: "estimate" as const };
    return {
      ...p,
      ownership: match.percentOwned,
      startedPct: match.percentStarted,
      ownershipChange: match.percentChange,
      adp: match.adp,
      injury: p.injury ?? match.injury,
      ownershipSource: "espn" as const,
    };
  });

  // Re-rank within each position now that real ownership is in play.
  const byPosition = new Map<string, PlayerStat[]>();
  for (const p of merged) {
    const list = byPosition.get(p.position) ?? [];
    list.push(p);
    byPosition.set(p.position, list);
  }
  for (const list of byPosition.values()) {
    list.sort((a, b) => b.ownership - a.ownership || (a.adp ?? 999) - (b.adp ?? 999));
    list.forEach((p, i) => {
      p.posRank = i + 1;
    });
  }

  return merged;
}

export async function getPlayerPool(): Promise<PlayerStat[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.pool;
  if (!inflight) {
    inflight = build()
      .then((pool) => {
        cache = { at: Date.now(), pool };
        return pool;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}
