/**
 * Zod schemas for every server-function input. These run inside
 * `.inputValidator()` so malformed or abusive payloads are rejected before
 * they reach ranking scans, pool filters, or the license gate.
 *
 * Bounds are deliberately generous — they exist to stop abuse (unbounded
 * arrays, garbage enums), not to second-guess the UI.
 */
import { z } from "zod";

const scoringFormat = z.enum(["std", "half", "ppr"]);
const slotPosition = z.enum(["QB", "RB", "WR", "TE", "FLEX", "DST", "K"]);
const realPosition = z.enum(["QB", "RB", "WR", "TE", "DEF", "K"]);

const leagueCred = z.object({
  leagueId: z.string().min(1).max(64),
  espnS2: z.string().max(2000).nullable().optional(),
  swid: z.string().max(200).nullable().optional(),
  season: z.number().int().min(2000).max(2100).nullable().optional(),
});

const licenseKey = z.string().min(1).max(200);

export const recommendationInput = z.object({
  format: scoringFormat,
  slot: slotPosition,
  maxOwnership: z.number().min(0).max(101),
  league: leagueCred.nullable().optional(),
  licenseKey: z.string().max(200).optional(),
});

export const watchlistInput = z.object({
  ids: z.array(z.string().min(1).max(100)).max(500),
  format: scoringFormat,
  licenseKey: z.string().max(200).optional(),
  requirePro: z.boolean().optional(),
});

export const searchInput = z.object({
  query: z.string().min(1).max(100),
  licenseKey: z.string().max(200),
});

export const matchRosterInput = z.object({
  lines: z.array(z.string().max(500)).max(50),
});

const leagueConfig = z.object({
  QB: z.number().int().min(0).max(4),
  RB: z.number().int().min(0).max(6),
  WR: z.number().int().min(0).max(6),
  TE: z.number().int().min(0).max(4),
  FLEX: z.number().int().min(0).max(4),
  DST: z.number().int().min(0).max(3),
  K: z.number().int().min(0).max(3),
  bench: z.number().int().min(0).max(30),
});

const rosterEntry = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  position: realPosition,
  starter: z.boolean(),
});

export const analyzeInput = z.object({
  format: scoringFormat,
  config: leagueConfig,
  roster: z.array(rosterEntry).max(40),
  maxOwnership: z.number().min(0).max(101),
  overrideSlot: slotPosition.nullable().optional(),
  league: leagueCred.nullable().optional(),
  licenseKey,
});

export const connectLeagueInput = leagueCred.extend({ licenseKey });

export const teamLeagueInput = leagueCred.extend({
  teamId: z.number().int().min(0).max(100),
  licenseKey,
});
