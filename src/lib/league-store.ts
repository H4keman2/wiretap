import { useCallback, useEffect, useState } from "react";

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
 * Client-side license gate for the paid Team Analyzer.
 * Placeholder for a Gumroad product-ID verification call.
 */
export function isValidLicense(key: string): boolean {
  return /^WT-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(key.trim());
}

export function usePro() {
  const [key, setKey] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setKey(window.localStorage.getItem(LICENSE_KEY));
    setLoaded(true);
  }, []);

  const activate = useCallback((candidate: string) => {
    if (!isValidLicense(candidate)) return false;
    window.localStorage.setItem(LICENSE_KEY, candidate.trim().toUpperCase());
    setKey(candidate.trim().toUpperCase());
    return true;
  }, []);

  const deactivate = useCallback(() => {
    window.localStorage.removeItem(LICENSE_KEY);
    setKey(null);
  }, []);

  return { isPro: Boolean(key && isValidLicense(key)), key, activate, deactivate, loaded };
}
