/**
 * Sleeper public API adapter (no auth required).
 *
 * Sleeper does not publish a true "rostered %" field, so ownership is
 * estimated from overall interest rank plus trending add/drop volume.
 * The UI states clearly that this is a proxy for availability.
 */

import type { PlayerStat, RealPosition } from "./ranking";

const PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";
const TRENDING = (kind: "add" | "drop") =>
  `https://api.sleeper.app/v1/players/nfl/trending/${kind}?lookback_hours=24&limit=300`;

const TTL_MS = 1000 * 60 * 60 * 6;

interface RawPlayer {
  player_id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  team?: string | null;
  position?: string | null;
  fantasy_positions?: string[] | null;
  active?: boolean;
  status?: string | null;
  search_rank?: number | null;
  depth_chart_order?: number | null;
  injury_status?: string | null;
}

const VALID: RealPosition[] = ["QB", "RB", "WR", "TE", "DEF", "K"];

let cache: { at: number; pool: PlayerStat[] } | null = null;
let inflight: Promise<PlayerStat[]> | null = null;

/** Estimated share of leagues rostering a player, derived from interest rank. */
function estimateOwnership(searchRank: number | null | undefined, addCount: number): number {
  const rank = searchRank && searchRank > 0 ? searchRank : 900;
  const base = 100 * Math.exp(-rank / 170);
  const trendBump = Math.min(12, Math.log10(Math.max(1, addCount)) * 4);
  return Math.max(0.5, Math.min(99.5, base + trendBump));
}

async function fetchTrending(kind: "add" | "drop"): Promise<Map<string, number>> {
  try {
    const res = await fetch(TRENDING(kind));
    if (!res.ok) return new Map();
    const rows = (await res.json()) as Array<{ player_id: string; count: number }>;
    return new Map(rows.map((r) => [r.player_id, r.count ?? 0]));
  } catch {
    return new Map();
  }
}

async function build(): Promise<PlayerStat[]> {
  const [res, adds, drops] = await Promise.all([
    fetch(PLAYERS_URL),
    fetchTrending("add"),
    fetchTrending("drop"),
  ]);
  if (!res.ok) throw new Error(`Sleeper player fetch failed (${res.status})`);
  const raw = (await res.json()) as Record<string, RawPlayer>;

  const byPosition = new Map<RealPosition, PlayerStat[]>();

  for (const p of Object.values(raw)) {
    const pos = (p.position ?? p.fantasy_positions?.[0] ?? "") as RealPosition;
    if (!VALID.includes(pos)) continue;
    if (pos !== "DEF" && p.active === false) continue;
    if (pos !== "DEF" && !p.team) continue;

    const name = p.full_name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
    if (!name) continue;

    const addCount = adds.get(p.player_id) ?? 0;
    const stat: PlayerStat = {
      id: p.player_id,
      name,
      team: p.team ?? null,
      position: pos,
      ownership: estimateOwnership(p.search_rank, addCount),
      addCount,
      dropCount: drops.get(p.player_id) ?? 0,
      depthOrder: p.depth_chart_order ?? null,
      posRank: 0,
      injury: p.injury_status ?? null,
    };
    const list = byPosition.get(pos) ?? [];
    list.push(stat);
    byPosition.set(pos, list);
  }

  const pool: PlayerStat[] = [];
  for (const list of byPosition.values()) {
    list.sort((a, b) => b.ownership - a.ownership);
    list.forEach((p, i) => {
      p.posRank = i + 1;
      pool.push(p);
    });
  }
  return pool;
}

export async function getSleeperPool(): Promise<PlayerStat[]> {
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
