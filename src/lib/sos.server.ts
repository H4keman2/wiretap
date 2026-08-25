/**
 * Strength of schedule (SOS).
 *
 * Two public ESPN feeds, no auth:
 *  - standings (previous completed season) -> points allowed per game, the
 *    proxy for how tough each defense is to score fantasy points against.
 *  - weekly scoreboard (current regular season) -> the next few matchups
 *    for every team.
 *
 * Difficulty is expressed 0-10 (10 = hardest slate) plus a letter grade so the
 * card can show a verdict up front and the matchup list below.
 */

import type { SosHealth, SosMatchup, TeamSos } from "./sos";

export type { SosHealth, SosMatchup, TeamSos };

const TTL_MS = 1000 * 60 * 60 * 12;
/**
 * When coverage is degraded we deliberately do NOT cache for 12h — the next
 * request past this cooldown re-probes ESPN instead of serving a thin map.
 */
const DEGRADED_RETRY_MS = 1000 * 30;
/** Below this many teams with matchups, coverage counts as degraded. */
const MIN_TEAMS_WITH_MATCHUPS = 28;
const WINDOW = 4;
const ESPN_SITE_API = "https://site.web.api.espn.com/apis";

const ABBR_FIX: Record<string, string> = { WSH: "WAS" };

function norm(abbr: string | undefined): string | null {
  if (!abbr) return null;
  const up = abbr.toUpperCase();
  return ABBR_FIX[up] ?? up;
}

interface StandingsEntry {
  team?: { abbreviation?: string };
  stats?: Array<{ name?: string; value?: number }>;
}

interface StandingsNode {
  children?: StandingsNode[];
  standings?: { entries?: StandingsEntry[] };
}

interface ScoreboardResponse {
  events?: Array<{
    week?: { number?: number };
    competitions?: Array<{
      competitors?: Array<{ homeAway?: string; team?: { abbreviation?: string } }>;
    }>;
  }>;
  season?: { year?: number; type?: number };
  week?: { number?: number };
}

function seasonYear(): number {
  const now = new Date();
  return now.getUTCMonth() < 2 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
}

async function json<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "WireTap/1.0 (fantasy football schedule analysis)",
      },
    });
    if (!res.ok) {
      console.error(`[SOS] ESPN request failed (${res.status})`, url);
      return null;
    }
    return (await res.json()) as T;
  } catch (error) {
    console.error("[SOS] ESPN request failed", url, error);
    return null;
  }
}

/** Points allowed per game last season, keyed by team abbreviation. */
async function defenseStrength(year: number): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const data = await json<StandingsNode>(
    `${ESPN_SITE_API}/v2/sports/football/nfl/standings?season=${year}`,
  );
  if (!data) return out;

  const entries: StandingsEntry[] = [];
  const walk = (node: StandingsNode) => {
    node.children?.forEach(walk);
    entries.push(...(node.standings?.entries ?? []));
  };
  walk(data);

  for (const entry of entries) {
    const team = norm(entry.team?.abbreviation);
    if (!team) continue;
    const stat = (name: string) => entry.stats?.find((s) => s.name === name)?.value ?? 0;
    const games = stat("wins") + stat("losses") + stat("ties");
    const against = stat("pointsAgainst");
    if (!games || !against) continue;
    out.set(team, against / games);
  }
  return out;
}

/** Which regular-season week the app should start the SOS window from. */
async function currentWeek(): Promise<number> {
  const board = await json<ScoreboardResponse>(
    `${ESPN_SITE_API}/site/v2/sports/football/nfl/scoreboard`,
  );
  if (board?.season?.type === 2 && board.week?.number) return board.week.number;
  return 1; // pre-season or offseason: look ahead from week 1
}

async function weekMatchups(year: number, week: number) {
  const board = await json<ScoreboardResponse>(
    `${ESPN_SITE_API}/site/v2/sports/football/nfl/scoreboard?dates=${year}&seasontype=2&week=${week}`,
  );
  const pairs: Array<{ team: string; opponent: string; home: boolean }> = [];
  for (const event of board?.events ?? []) {
    const competitors = event.competitions?.[0]?.competitors ?? [];
    if (competitors.length !== 2) continue;
    const a = competitors[0]!;
    const b = competitors[1]!;
    const teamA = norm(a.team?.abbreviation);
    const teamB = norm(b.team?.abbreviation);
    if (!teamA || !teamB) continue;
    pairs.push({ team: teamA, opponent: teamB, home: a.homeAway === "home" });
    pairs.push({ team: teamB, opponent: teamA, home: b.homeAway === "home" });
  }
  return pairs;
}

/**
 * Map points allowed per game to a 0-10 difficulty where a stingy defense
 * (low points allowed) scores high.
 */
function toDifficulty(pointsAllowed: number, min: number, max: number): number {
  if (max <= min) return 5;
  const eased = (max - pointsAllowed) / (max - min);
  return Math.round(Math.max(0, Math.min(1, eased)) * 100) / 10;
}

function gradeOf(rating: number): { grade: TeamSos["grade"]; label: TeamSos["label"] } {
  if (rating < 3.5) return { grade: "A", label: "easy" };
  if (rating < 4.75) return { grade: "B", label: "favorable" };
  if (rating < 6) return { grade: "C", label: "neutral" };
  if (rating < 7.25) return { grade: "D", label: "tough" };
  return { grade: "F", label: "brutal" };
}

async function build(): Promise<Map<string, TeamSos>> {
  const year = seasonYear();
  const [defense, week] = await Promise.all([defenseStrength(year - 1), currentWeek()]);

  if (defense.size === 0) {
    throw new Error(`[SOS] No defensive standings returned for ${year - 1}`);
  }

  const values = [...defense.values()];
  const min = Math.min(...values);
  const max = Math.max(...values);

  const weeks = Array.from({ length: WINDOW }, (_, i) => week + i).filter((w) => w <= 18);
  const results = await Promise.all(weeks.map((w) => weekMatchups(year, w)));

  if (results.every((pairs) => pairs.length === 0)) {
    throw new Error(`[SOS] No regular-season matchups returned for ${year}, weeks ${weeks.join(", ")}`);
  }

  const byTeam = new Map<string, SosMatchup[]>();
  results.forEach((pairs, i) => {
    const w = weeks[i]!;
    for (const pair of pairs) {
      const allowed = defense.get(pair.opponent);
      const difficulty = allowed == null ? 5 : toDifficulty(allowed, min, max);
      const list = byTeam.get(pair.team) ?? [];
      list.push({ week: w, opponent: pair.opponent, home: pair.home, difficulty });
      byTeam.set(pair.team, list);
    }
  });

  const out = new Map<string, TeamSos>();
  for (const [team, matchups] of byTeam) {
    matchups.sort((a, b) => a.week - b.week);
    const rating =
      Math.round(
        (matchups.reduce((sum, m) => sum + m.difficulty, 0) / Math.max(1, matchups.length)) * 10,
      ) / 10;
    out.set(team, { team, rating, ...gradeOf(rating), matchups });
  }
  return out;
}

let cache: { at: number; map: Map<string, TeamSos>; degraded: boolean } | null = null;
let inflight: Promise<Map<string, TeamSos>> | null = null;
let lastError: string | null = null;

function coverage(map: Map<string, TeamSos>): number {
  return [...map.values()].filter((t) => t.matchups.length > 0).length;
}

function cacheIsFresh(): boolean {
  if (!cache) return false;
  const ttl = cache.degraded ? DEGRADED_RETRY_MS : TTL_MS;
  return Date.now() - cache.at < ttl;
}

/** Coverage snapshot for the debug panel and the in-app warning banner. */
export function getSosHealth(): SosHealth {
  const teamsWithMatchups = cache ? coverage(cache.map) : 0;
  const degraded = cache ? cache.degraded : true;
  return {
    teamsWithMatchups,
    threshold: MIN_TEAMS_WITH_MATCHUPS,
    degraded,
    willReprobe: !cacheIsFresh(),
    lastProbeAt: cache ? new Date(cache.at).toISOString() : null,
    lastError,
  };
}

export async function getSosMap(): Promise<Map<string, TeamSos>> {
  if (cacheIsFresh()) return cache!.map;
  if (!inflight) {
    inflight = build()
      .then((map) => {
        const teams = coverage(map);
        const degraded = teams < MIN_TEAMS_WITH_MATCHUPS;
        if (degraded) {
          console.warn(
            `[SOS] Degraded coverage: ${teams}/${MIN_TEAMS_WITH_MATCHUPS} teams with matchups — will re-probe on the next request.`,
          );
          lastError = `Only ${teams} of ${MIN_TEAMS_WITH_MATCHUPS} teams resolved upcoming matchups.`;
        } else {
          lastError = null;
        }
        cache = { at: Date.now(), map, degraded };
        return map;
      })
      .catch((error) => {
        console.error("[SOS] Unable to build schedule ratings", error);
        lastError = error instanceof Error ? error.message : "Schedule build failed.";
        const map = new Map<string, TeamSos>();
        cache = { at: Date.now(), map, degraded: true };
        return map;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}
