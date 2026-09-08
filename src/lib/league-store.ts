import { useCallback, useEffect, useState } from "react";

import type { LeagueCred, LeagueSummary } from "./league.functions";
import { verifyLicense } from "./license.server";

import type { ScoringFormat } from "./ranking";
import { DEFAULT_LEAGUE, type LeagueConfig, type RosterEntry } from "./weakness";

export interface LeagueProfile {
  name: string;
  format: ScoringFormat;
  config: LeagueConfig;
  roster: RosterEntry[];
}

const KEY = "wiretap.league.v1";
const LICENSE_KEY = "wiretap.license.v1";
/** How long a verified-Pro result is trusted client-side before re-checking. */
const PRO_CACHE_MS = 1000 * 60 * 60 * 12;
const PRO_CACHE_KEY = "wiretap.license.verified-at.v1";

export const EMPTY_PROFILE: LeagueProfile = {
  name: "My League",
  format: "ppr",
  config: DEFAULT_LEAGUE,
  roster: [],
};

function read(): LeagueProfile {
  if (typeof window === "undefined") return EMPTY_PROFILE;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_PROFILE;
    return { ...EMPTY_PROFILE, ...(JSON.parse(raw) as Partial<LeagueProfile>) } as LeagueProfile;
  } catch {
    return EMPTY_PROFILE;
  }
}

/** Reusable league profile so returning users never re-enter settings weekly. */
export function useLeagueProfile() {
  const [profile, setProfile] = useState<LeagueProfile>(EMPTY_PROFILE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setProfile(read());
    setLoaded(true);
  }, []);

  const update = useCallback((patch: Partial<LeagueProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  return { profile, update, loaded };
}

/**
 * Pro gate for the Team Analyzer.
 *
 * The client only ever caches whether a key has *already been verified* by
 * the server, and re-checks periodically. The real authority lives in
 * license.server.ts / requireValidLicense, which `analyzeTeam` calls on
 * every request — the client state below is UI convenience only and is
 * never trusted by the server function itself.
 */
export function usePro() {
  const [key, setKey] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recheck = useCallback(async (candidate: string) => {
    setChecking(true);
    setError(null);
    try {
      const result = await verifyLicense({ data: { licenseKey: candidate } });
      if (result.valid) {
        window.localStorage.setItem(LICENSE_KEY, candidate.trim());
        window.localStorage.setItem(PRO_CACHE_KEY, String(Date.now()));
        setKey(candidate.trim());
        setIsPro(true);
      } else {
        window.localStorage.removeItem(LICENSE_KEY);
        window.localStorage.removeItem(PRO_CACHE_KEY);
        setKey(null);
        setIsPro(false);
        setError(result.reason ?? "That key doesn't look right.");
      }
      return result.valid;
    } catch {
      setError("Could not reach the license server, try again shortly.");
      return false;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(LICENSE_KEY);
    const verifiedAt = Number(window.localStorage.getItem(PRO_CACHE_KEY) ?? 0);
    const fresh = Date.now() - verifiedAt < PRO_CACHE_MS;

    if (!stored) {
      setLoaded(true);
      return;
    }

    setKey(stored);
    if (fresh) {
      // Trust the cache short-term so we're not hitting Gumroad on every
      // page load, but every real analyzeTeam call is still re-verified
      // server-side regardless of this flag.
      setIsPro(true);
      setLoaded(true);
    } else {
      recheck(stored).finally(() => setLoaded(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activate = useCallback((candidate: string) => recheck(candidate), [recheck]);

  const deactivate = useCallback(() => {
    window.localStorage.removeItem(LICENSE_KEY);
    window.localStorage.removeItem(PRO_CACHE_KEY);
    setKey(null);
    setIsPro(false);
  }, []);

  return { isPro, key, activate, deactivate, loaded, checking, error };
}

/* ------------------------------------------------------------------ *
 * Connected ESPN league
 *
 * Stores the league id and the user's own ESPN session cookies on this
 * device only, plus the last league snapshot summary and which team is
 * theirs. Every server call passes the cookies through per request; they
 * are never persisted server-side.
 * ------------------------------------------------------------------ */

const ESPN_KEY = "wiretap.espn-league.v1";

export interface EspnConnection {
  leagueId: string;
  espnS2: string;
  swid: string;
  teamId: number | null;
  summary: LeagueSummary | null;
}

export const EMPTY_CONNECTION: EspnConnection = {
  leagueId: "",
  espnS2: "",
  swid: "",
  teamId: null,
  summary: null,
};

export function useEspnConnection() {
  const [connection, setConnection] = useState<EspnConnection>(EMPTY_CONNECTION);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ESPN_KEY);
      if (raw) {
        setConnection({ ...EMPTY_CONNECTION, ...(JSON.parse(raw) as Partial<EspnConnection>) });
      }
    } catch {
      /* ignore unreadable storage */
    }
    setLoaded(true);
  }, []);

  const save = useCallback((patch: Partial<EspnConnection>) => {
    setConnection((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(ESPN_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(ESPN_KEY);
    } catch {
      /* storage unavailable */
    }
    setConnection(EMPTY_CONNECTION);
  }, []);

  /** Credentials to hand to server functions, or null when not connected. */
  const cred: LeagueCred | null =
    connection.summary && connection.leagueId
      ? { leagueId: connection.leagueId, espnS2: connection.espnS2, swid: connection.swid }
      : null;

  return { connection, cred, save, clear, loaded };
}
