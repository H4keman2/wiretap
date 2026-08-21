import { useCallback, useEffect, useState } from "react";

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
