/**
 * SOS diagnostics.
 *
 * Re-probes the exact ESPN endpoints the SOS pipeline uses and reports raw
 * HTTP status, the season/week parameters that were derived, and which players
 * in the live pool fail to resolve to a team schedule.
 */

import type { ProbeResult, SosDiagnostics, UnmappedPlayer } from "./sos-diagnostics";

export type { ProbeResult, SosDiagnostics, UnmappedPlayer };

const ESPN_SITE_API = "https://site.web.api.espn.com/apis";
const WINDOW = 4;


function seasonYear(): number {
  const now = new Date();
  return now.getUTCMonth() < 2 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
}

async function probe(label: string, url: string): Promise<{ result: ProbeResult; body: unknown }> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "WireTap/1.0 (fantasy football schedule analysis)",
      },
    });
    const ms = Date.now() - started;
    let body: unknown = null;
    let note = "";
    try {
      body = await res.json();
    } catch {
      note = "response body was not valid JSON";
    }
    return {
      result: { label, url, status: res.status, ok: res.ok, ms, note },
      body,
    };
  } catch (error) {
    return {
      result: {
        label,
        url,
        status: null,
        ok: false,
        ms: Date.now() - started,
        note: error instanceof Error ? error.message : "fetch threw",
      },
      body: null,
    };
  }
}

export async function collectSosDiagnostics(): Promise<SosDiagnostics> {
  const year = seasonYear();
  const probes: ProbeResult[] = [];

  const standings = await probe(
    "Standings (points allowed)",
    `${ESPN_SITE_API}/v2/sports/football/nfl/standings?season=${year - 1}`,
  );
  probes.push(standings.result);

  const board = await probe(
    "Scoreboard (current week)",
    `${ESPN_SITE_API}/site/v2/sports/football/nfl/scoreboard`,
  );
  const boardBody = board.body as
    | { season?: { type?: number; year?: number }; week?: { number?: number } }
    | null;
  const scoreboardWeek =
    boardBody?.season?.type === 2 && boardBody.week?.number ? boardBody.week.number : null;
  const currentWeek = scoreboardWeek ?? 1;
  probes.push({
    ...board.result,
    note:
      board.result.note ||
      `season.type=${boardBody?.season?.type ?? "?"} week=${boardBody?.week?.number ?? "?"}`,
  });

  const weeks = Array.from({ length: WINDOW }, (_, i) => currentWeek + i).filter((w) => w <= 18);
  for (const w of weeks) {
    const url = `${ESPN_SITE_API}/site/v2/sports/football/nfl/scoreboard?dates=${year}&seasontype=2&week=${w}`;
    const res = await probe(`Week ${w} matchups`, url);
    const events = (res.body as { events?: unknown[] } | null)?.events ?? [];
    probes.push({ ...res.result, note: res.result.note || `${events.length} events` });
  }

  const { getSosMap } = await import("./sos.server");
  const { getPlayerPool } = await import("./players.server");
  const [sos, pool] = await Promise.all([getSosMap(), getPlayerPool()]);

  const teamsWithMatchups = [...sos.values()].filter((t) => t.matchups.length > 0).length;
  const sampleTeams = [...sos.values()].slice(0, 5).map((t) => ({
    team: t.team,
    grade: t.grade,
    rating: t.rating,
    matchups: t.matchups.length,
  }));

  const unmapped: UnmappedPlayer[] = [];
  let mapped = 0;
  for (const p of pool) {
    if (p.sos && p.sos.matchups.length > 0) {
      mapped += 1;
      continue;
    }
    const reason: UnmappedPlayer["reason"] = !p.team
      ? "no-nfl-team"
      : !sos.has(p.team)
        ? "team-not-in-schedule"
        : "no-matchups";
    unmapped.push({ id: p.id, name: p.name, position: p.position, team: p.team, reason });
  }

  const unmappedByReason: Record<string, number> = {};
  for (const u of unmapped) {
    unmappedByReason[u.reason] = (unmappedByReason[u.reason] ?? 0) + 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    params: {
      seasonYear: year,
      standingsSeason: year - 1,
      currentWeek,
      weeksRequested: weeks,
      weekSource: scoreboardWeek ? "scoreboard" : "fallback",
    },
    probes,
    schedule: { teamsWithSos: sos.size, teamsWithMatchups, sampleTeams },
    pool: {
      total: pool.length,
      mapped,
      unmapped: unmapped.length,
      unmappedByReason,
      unmappedSample: unmapped.slice(0, 25),
    },
  };
}
