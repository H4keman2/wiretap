import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, ClipboardList, Plus, Shield, Trash2 } from "lucide-react";

import { InjuryAlerts } from "@/components/wire/InjuryAlerts";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { FormatSelector, OwnershipSlider, PositionSelector } from "@/components/wire/Controls";
import { PlayerRow } from "@/components/wire/PlayerRow";
import { Page, PromoCard, ProxyNote, SectionLabel } from "@/components/wire/Shell";
import { ProFeatureSection } from "@/components/wire/ProFeatureSection";
import { SosWarning } from "@/components/wire/SosWarning";
import { LIVE_REFRESH_MS } from "@/components/wire/LiveWatch";
import { importLeagueRoster } from "@/lib/league.functions";
import { useEspnConnection, useLeagueProfile, usePro } from "@/lib/league-store";
import { useLiveUpdates } from "@/lib/live-updates-store";

import { lineupFill, suggestStarterDefault } from "@/lib/lineup";
import type { RealPosition, SlotPosition } from "@/lib/ranking";
import { cn } from "@/lib/utils";
import {
  analyzeTeam,
  matchRosterPlayers,
  searchPlayers,
  type RosterPoint,
} from "@/lib/waivers.functions";
import type { LeagueConfig, RosterEntry } from "@/lib/weakness";

export const Route = createFileRoute("/analyzer")({
  head: () => ({
    meta: [
      { title: "Team Analyzer — Find Your Weakest Position | Wire Tap" },
      {
        name: "description",
        content:
          "Enter your fantasy football roster once and Wire Tap scores every position against replacement level, flags your weakest spots, and pulls matching waiver targets.",
      },
      { property: "og:title", content: "Team Analyzer — Find Your Weakest Position" },
      {
        property: "og:description",
        content:
          "Positional strength scoring with the reasoning shown, plus ranked waiver pickups for the spots your roster actually needs.",
      },
    ],
  }),
  component: Analyzer,
});

const POSITIONS: RealPosition[] = ["QB", "RB", "WR", "TE", "DEF", "K"];

function Analyzer() {
  const { profile, update, loaded } = useLeagueProfile();
  const { isPro, key, loaded: proLoaded } = usePro();
  const { connection, cred } = useEspnConnection();
  const [maxOwnership, setMaxOwnership] = useState(40);
  const [override, setOverride] = useState<SlotPosition | null>(null);
  const [pulling, setPulling] = useState(false);

  const { enabled: live } = useLiveUpdates();

  const roster = profile.roster;
  const starters = useMemo(() => roster.filter((r) => r.starter), [roster]);
  const fill = useMemo(() => lineupFill(roster, profile.config), [roster, profile.config]);

  // Runs on a live cycle rather than only on edit, so a starter being ruled
  // out (or cleared) re-scores the roster and refreshes the waiver targets on
  // its own. The server re-verifies the license on every call, so a stale key
  // here just comes back as PRO_REQUIRED.
  const analysis = useQuery({
    queryKey: [
      "analysis",
      profile.format,
      JSON.stringify(profile.config),
      JSON.stringify(roster),
      maxOwnership,
      override ?? "auto",
      cred?.leagueId ?? "national",
    ],
    queryFn: () =>
      analyzeTeam({
        data: {
          format: profile.format,
          config: profile.config,
          roster,
          maxOwnership,
          overrideSlot: override,
          league: cred,
          licenseKey: key!,
        },
      }),
    enabled: loaded && isPro && !!key && roster.length > 0,
    staleTime: live ? 0 : 1000 * 60 * 10,
    refetchInterval: live ? LIVE_REFRESH_MS : false,
    refetchIntervalInBackground: false,
  });

  const pullLeagueRoster = async () => {
    if (!cred || connection.teamId === null) return;
    setPulling(true);
    try {
      const { entries, unmatched } = await importLeagueRoster({
        data: { ...cred, teamId: connection.teamId, licenseKey: key ?? "" },
      });
      update({ roster: entries });
      toast.success(
        unmatched.length > 0
          ? `Pulled ${entries.length} players — ${unmatched.length} need a name check.`
          : `Pulled all ${entries.length} players from your league team.`,
      );
    } catch {
      toast.error("Couldn't pull that roster. Check your league details in Settings.");
    } finally {
      setPulling(false);
    }
  };

  // Announce *changes* in status, not the same tag over and over: a starter
  // newly tagged gets a warning with the replacement, and a starter whose tag
  // cleared gets an all-clear so the user knows to put him back in.
  const seenInjuries = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    const data = analysis.data;
    if (!data) return;
    const current = new Map(data.injuryAlerts.map((a) => [a.playerId, a.injury]));
    const prev = seenInjuries.current;
    seenInjuries.current = current;

    if (!prev) {
      const urgent = data.injuryAlerts.filter((a) => a.severity !== "questionable");
      const alert = urgent[0] ?? data.injuryAlerts[0];
      if (!alert) return;
      const count = data.injuryAlerts.length;
      toast.warning(`${alert.playerName} — ${alert.injury}`, {
        description: alert.best
          ? `Start ${alert.best.name} instead (${alert.best.projection.toFixed(1)} proj pts).${count > 1 ? ` ${count - 1} more starter${count > 2 ? "s" : ""} tagged.` : ""}`
          : `No healthy replacement found at ${alert.position}.`,
      });
      return;
    }

    for (const alert of data.injuryAlerts) {
      if (prev.get(alert.playerId) === alert.injury) continue;
      toast.warning(`${alert.playerName} — ${alert.injury}`, {
        description: alert.best
          ? `Start ${alert.best.name} instead (${alert.best.projection.toFixed(1)} proj pts).`
          : `No healthy replacement found at ${alert.position}.`,
      });
    }

    for (const [id, tag] of prev) {
      if (current.has(id)) continue;
      const name = roster.find((r) => r.id === id)?.name ?? "Your starter";
      toast.success(`${name} is cleared to play`, {
        description: `No longer listed as ${tag} — he's back in your lineup.`,
      });
    }
    // roster is only read for a display name here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis.data]);

  if (!proLoaded || !loaded) {
    return (
      <Page format={profile.format}>
        <span className="sr-only" role="status">Loading analyzer…</span>
        <Skeleton className="h-40 rounded-xl" aria-hidden="true" />
      </Page>
    );
  }

  if (!isPro) return <Paywall format={profile.format} />;

  const result = analysis.data;

  return (
    <Page format={profile.format}>
      <h1 className="font-display text-3xl uppercase leading-none">Team Analyzer</h1>
      <SosWarning />
      <section className="space-y-3">
        <SectionLabel>Scoring format</SectionLabel>
        <FormatSelector value={profile.format} onChange={(format) => update({ format })} />
        <p className="px-1 text-[11px] text-muted-foreground">
          Starting lineup and bench size live in{" "}
          <Link to="/settings" className="font-bold text-turf underline">
            League settings
          </Link>{" "}
          — every league's slots are different (3 starting WR, 2 FLEX, whatever yours runs), so set
          it there once and it applies here automatically.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {fill.map((f) => (
            <span
              key={f.slot}
              className={cn(
                "rounded px-2 py-1 text-[10px] font-black uppercase tabular-nums tracking-tight",
                f.filled >= f.required
                  ? "bg-action/15 text-turf"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              {f.slot} {f.filled}/{f.required}
            </span>
          ))}
          <span className="rounded bg-secondary px-2 py-1 text-[10px] font-black uppercase tabular-nums tracking-tight text-muted-foreground">
            Bench {roster.length - starters.length}/{profile.config.bench}
          </span>
        </div>
      </section>

      {cred && (
        <section className="space-y-2 rounded-xl border border-action/50 bg-card p-4">
          <p className="text-sm font-bold">{connection.summary?.name}</p>
          {connection.teamId === null ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Pick which team is yours in{" "}
              <Link to="/settings" className="font-bold text-turf underline">
                Settings
              </Link>{" "}
              to pull your roster in automatically.
            </p>
          ) : (
            <>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Pull your current roster straight from your league — this replaces what's below.
              </p>
              <Button
                size="sm"
                className="h-9 w-full"
                disabled={pulling}
                onClick={pullLeagueRoster}
              >
                {pulling ? "Pulling your team…" : "Sync my roster"}
              </Button>
            </>
          )}
        </section>
      )}

      <RosterEditor
        roster={roster}
        config={profile.config}
        rosterPoints={result?.rosterPoints}
        suggestedStarterIds={result?.suggestedStarterIds}
        onChange={(next) => update({ roster: next })}
      />

      {roster.length === 0 && (
        <p className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
          Add your players above to score your positions.
        </p>
      )}

      {result && (
        <>
          <PromoCard>
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded bg-action px-1.5 py-0.5 text-[10px] font-black text-action-foreground">
                VERDICT
              </span>
              <h2 className="text-sm font-bold uppercase tracking-wide text-action">
                Weakness detected
              </h2>
            </div>
            <p className="mb-2 font-display text-2xl uppercase leading-none">
              Weakest:{" "}
              {result.verdicts
                .slice(0, 2)
                .map((v) => v.slot)
                .join(", then ")}{" "}
              ({result.verdicts[0]?.score}/100)
            </p>
            <p className="text-xs text-depth-foreground/75">{result.verdicts[0]?.reasons[0]}</p>
          </PromoCard>

          <section className="space-y-2">
            <SectionLabel>Positional strength</SectionLabel>
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {result.verdicts.map((v) => (
                <details key={v.slot} className="group px-3 py-2.5">
                  <summary className="flex cursor-pointer items-center gap-3 list-none">
                    <span className="w-12 font-display text-lg uppercase">{v.slot}</span>
                    <span
                      role="progressbar"
                      aria-valuenow={Math.round(v.score)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${v.slot} positional strength`}
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"
                    >
                      <span
                        className={cn(
                          "block h-full rounded-full",
                          v.score < 45
                            ? "bg-destructive"
                            : v.score < 70
                              ? "bg-chart-4"
                              : "bg-action",
                        )}
                        style={{ width: `${Math.min(100, v.score)}%` }}
                      />
                    </span>
                    <span
                      className="w-14 text-right text-sm font-black tabular-nums"
                      title="Positional strength, scored 0 to 100 against replacement level"
                    >
                      {v.score}
                      <span className="text-[9px] font-normal text-muted-foreground">/100</span>
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                      aria-hidden="true"
                    />
                  </summary>
                  <ul className="mt-2 space-y-1 pl-1 text-[11px] leading-snug text-muted-foreground">
                    {v.reasons.map((r) => (
                      <li key={r}>• {r}</li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </section>

          <InjuryAlerts
            alerts={result.injuryAlerts}
            updatedAt={result.injuryUpdatedAt}
            live={live}
            checking={analysis.isFetching}
          />

          {result.handcuffs.length > 0 && (
            <section className="space-y-2">
              <SectionLabel>Handcuffs available</SectionLabel>
              <p className="px-1 text-[11px] text-muted-foreground">
                The direct backup behind one of your starters — cheap insurance if that starter gets
                hurt, and often only valuable to whoever owns the starter.
              </p>
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {result.handcuffs.map((h) => (
                  <div key={h.handcuff.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Shield className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {h.handcuff.name}{" "}
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {h.handcuff.team ?? "FA"} · {h.handcuff.position}
                        </span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">{h.reason}</p>
                    </div>
                    <span className="shrink-0 text-[11px] font-black tabular-nums text-muted-foreground">
                      {Math.round(h.handcuff.ownership)}% owned
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2 pr-1">
              <SectionLabel>Override position</SectionLabel>
              {override !== null && (
                <button
                  type="button"
                  onClick={() => setOverride(null)}
                  aria-label="Stop pinning a position and let Wire Tap detect the weakest one again"
                  className="shrink-0 text-[10px] font-black uppercase tracking-wide text-turf underline"
                >
                  Auto
                </button>
              )}
            </div>
            <PositionSelector
              value={override ?? result.targetSlot}
              onChange={(slot) => setOverride(slot)}
            />
            <OwnershipSlider value={maxOwnership} onChange={setMaxOwnership} />
          </section>

          <section className="space-y-4">
            <SectionLabel>
              All {result.targetSlot} targets under {maxOwnership}% owned
            </SectionLabel>
            {result.recommendations.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">
                  Nothing under {maxOwnership}% rostered at {result.targetSlot}. Raise the
                  threshold.
                </p>
                {maxOwnership < 100 && (
                  <button
                    type="button"
                    onClick={() => setMaxOwnership((v) => Math.min(100, v + 20))}
                    className="mt-3 rounded bg-action px-4 py-2 text-xs font-bold uppercase text-action-foreground"
                  >
                    Widen pool
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {result.recommendations.map((p, i) => (
                  <PlayerRow key={p.id} player={p} rank={i + 1} format={profile.format} />
                ))}
              </div>
            )}
            <ProxyNote />
          </section>
        </>
      )}

      {analysis.isFetching && !result && (
        <>
          <span className="sr-only" role="status">Loading analysis…</span>
          <Skeleton className="h-28 rounded-xl" aria-hidden="true" />
        </>
      )}

      {analysis.isError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
          <p role="alert" className="text-xs text-destructive">
            {String(analysis.error).includes("PRO_REQUIRED")
              ? "Your license couldn't be verified. Check your key in League settings."
              : "Something went wrong running the analysis. Try again in a moment."}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 h-7 text-[11px]"
            disabled={analysis.isFetching}
            onClick={() => analysis.refetch()}
          >
            Try again
          </Button>
        </div>
      )}
    </Page>
  );
}

function RosterEditor({
  roster,
  config,
  rosterPoints,
  suggestedStarterIds,
  onChange,
}: {
  roster: RosterEntry[];
  config: LeagueConfig;
  rosterPoints?: RosterPoint[] | undefined;
  suggestedStarterIds?: string[] | undefined;
  onChange: (next: RosterEntry[]) => void;
}) {
  const [query, setQuery] = useState("");
  const { key } = usePro();
  // Shared by the search input and the suggestions list so assistive tech can
  // tie the two together (same combobox wiring as the trade page's PlayerSearch).
  const listId = useId();
  const [position, setPosition] = useState<RealPosition>("RB");
  const [options, setOptions] = useState<
    Array<{ id: string; name: string; team: string | null; position: string }>
  >([]);
  const [searchError, setSearchError] = useState(false);
  const [searchRetry, setSearchRetry] = useState(0);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [importing, setImporting] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
  }, [query, options]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setOptions([]);
      setSearchError(false);
      return;
    }
    let cancelled = false;
    setSearchError(false);
    const t = setTimeout(() => {
      searchPlayers({ data: { query, licenseKey: key ?? "" } })
        .then((rows) => {
          if (cancelled) return;
          setOptions(rows);
          setSearchError(false);
        })
        .catch(() => {
          if (cancelled) return;
          setOptions([]);
          setSearchError(true);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, searchRetry]);

  const add = (entry: Omit<RosterEntry, "starter">) => {
    if (roster.some((r) => r.id === entry.id)) {
      toast.error("Already on your roster.");
      return;
    }
    const starter = suggestStarterDefault(roster, entry.position, config);
    onChange([...roster, { ...entry, starter }]);
    setQuery("");
    setOptions([]);
  };

  // Enter and the Plus button must pick the same way: when suggestions are
  // showing, add the highlighted real player so it scores against real data;
  // only fall back to the typed manual entry when there is nothing to match.
  const submitAdd = () => {
    if (options.length > 0) {
      const picked = options[Math.min(active, options.length - 1)];
      add({
        id: picked.id,
        name: picked.name,
        position: picked.position as RealPosition,
      });
      return;
    }
    if (query.trim()) {
      add({
        id: `manual-${query.trim().toLowerCase()}`,
        name: query.trim(),
        position,
      });
    }
  };

  const handleImport = async () => {

    const lines = Array.from(
      new Set(
        bulkText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
      ),
    );
    if (lines.length === 0) return;

    setImporting(true);
    try {
      const results = await matchRosterPlayers({ data: { lines } });
      let working = roster;
      let added = 0;
      let unmatched = 0;
      let skipped = 0;
      for (const res of results) {
        if (working.some((r) => r.id === res.id)) {
          skipped += 1;
          continue;
        }
        const pos = res.position ?? position;
        const starter = suggestStarterDefault(working, pos, config);
        working = [...working, { id: res.id, name: res.name, position: pos, starter }];
        if (res.matched) added += 1;
        else unmatched += 1;
      }
      onChange(working);
      setBulkText("");
      setBulkOpen(false);

      if (added === 0 && unmatched === 0) {
        toast.error(skipped > 0 ? "Already on your roster." : "Couldn't read any names there.");
      } else {
        const bits = [`${added} matched`];
        if (unmatched > 0) bits.push(`${unmatched} unmatched — check name/position`);
        if (skipped > 0) bits.push(`${skipped} already on roster`);
        toast.success(`Imported: ${bits.join(", ")}.`);
      }
    } catch {
      toast.error("Import failed, try again in a moment.");
    } finally {
      setImporting(false);
    }
  };

  const pointsById = useMemo(
    () => new Map((rosterPoints ?? []).map((rp) => [rp.id, rp])),
    [rosterPoints],
  );

  const teamAverage = useMemo(() => {
    const starterPoints = roster
      .filter((r) => r.starter)
      .map((r) => pointsById.get(r.id))
      .filter((rp): rp is RosterPoint => !!rp);
    if (starterPoints.length === 0) return null;
    const avg = starterPoints.reduce((sum, rp) => sum + rp.projection, 0) / starterPoints.length;
    const unmatchedCount = starterPoints.filter((rp) => !rp.matched).length;
    return { avg, unmatchedCount, of: starterPoints.length };
  }, [roster, pointsById]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>Your roster</SectionLabel>
        <button
          type="button"
          aria-pressed={bulkOpen}
          onClick={() => setBulkOpen((v) => !v)}
          className="text-[11px] font-bold text-turf underline"
        >
          {bulkOpen ? "Add one at a time instead" : "Paste in your whole roster"}
        </button>
      </div>

      {bulkOpen ? (
        <div className="space-y-2 rounded-xl border border-border bg-card p-3">
          <Textarea
            aria-label="Roster names, one per line"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"One player per line, e.g.\nBo Nix\nKenneth Walker RB\nAmon-Ra St. Brown"}
            className="min-h-28 text-sm"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              A trailing position (RB, WR…) helps disambiguate common names.
            </p>
            <Button
              size="sm"
              className="h-9 shrink-0"
              disabled={importing || !bulkText.trim()}
              onClick={handleImport}
            >
              {importing ? "Matching…" : "Import"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                const count = options.length;
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  if (count === 0) return;
                  e.preventDefault();
                  setActive((i) => {
                    const current = Math.min(i, count - 1);
                    return e.key === "ArrowDown"
                      ? Math.min(current + 1, count - 1)
                      : Math.max(current - 1, 0);
                  });
                  return;
                }
                if (e.key !== "Enter") return;
                e.preventDefault();
                submitAdd();

              }}
              placeholder="Add player by name"
              aria-label="Add player by name"
              inputMode="search"
              aria-expanded={options.length > 0}
              aria-controls={options.length > 0 ? listId : undefined}
              aria-activedescendant={
                options.length > 0
                  ? `${listId}-option-${Math.min(active, options.length - 1)}`
                  : undefined
              }
              className="h-9 text-sm"
            />
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value as RealPosition)}
              className="h-9 rounded-md border border-input bg-card px-2 text-xs font-bold"
              aria-label="Position for manual add"
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p === "DEF" ? "DST" : p}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              aria-label="Add player"
              className="h-9 shrink-0"
              onClick={submitAdd}

            >
              <Plus aria-hidden="true" className="size-4" />
            </Button>
          </div>

          {searchError && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-background px-3 py-2">
              <p role="alert" className="text-[11px] text-destructive">
                Couldn't search players — check your connection.
              </p>
              <button
                type="button"
                onClick={() => setSearchRetry((n) => n + 1)}
                className="rounded bg-action px-3 py-1 text-[10px] font-bold uppercase text-action-foreground"
              >
                Try again
              </button>
            </div>
          )}

          {options.length > 0 && (
            <ul
              id={listId}
              role="listbox"
              className="mt-2 divide-y divide-border overflow-hidden rounded-md border border-border"
            >
              {options.map((o, i) => (
                <li key={o.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    id={`${listId}-option-${i}`}
                    aria-selected={i === Math.min(active, options.length - 1)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs font-bold hover:bg-secondary ${i === Math.min(active, options.length - 1) ? "bg-secondary ring-1 ring-inset ring-action" : ""}`}
                    onClick={() =>
                      add({
                        id: o.id,
                        name: o.name,
                        position: o.position as RealPosition,
                      })
                    }
                  >
                    <span>{o.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {o.team ?? "FA"} • {o.position === "DEF" ? "DST" : o.position}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {roster.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2">
          <p className="text-[11px] text-muted-foreground">
            {teamAverage ? (
              <>
                Starters average{" "}
                <span className="font-black tabular-nums text-foreground">
                  {teamAverage.avg.toFixed(1)} pts/wk
                </span>{" "}
                ({teamAverage.of} starter{teamAverage.of === 1 ? "" : "s"})
                {teamAverage.unmatchedCount > 0 &&
                  ` — ${teamAverage.unmatchedCount} unmatched, scored at a generic baseline`}
              </>
            ) : (
              "Running the analysis to score your roster…"
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 text-[11px]"
            disabled={!suggestedStarterIds}
            onClick={() => {
              if (!suggestedStarterIds) return;
              const set = new Set(suggestedStarterIds);
              onChange(roster.map((r) => ({ ...r, starter: set.has(r.id) })));
              toast.success("Lineup set to your highest-projected legal starters.");
            }}
          >
            Auto-set lineup
          </Button>
        </div>
      )}

      {roster.length > 0 && (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {roster.map((r) => {
            // Typed-and-Add-button entries get a synthetic `manual-*` id
            // instead of a real player id from search, so the scoring engine
            // can't find their actual stats and silently substitutes a
            // generic replacement-level baseline for them. That's a fair
            // fallback, but it was invisible — flag it so a typo (or a name
            // that just isn't in the pool) doesn't read as a real score.
            const unmatched = r.id.startsWith("manual-");
            const pts = pointsById.get(r.id);
            return (
              <div key={r.id} className="flex items-center gap-2 px-3 py-2">
                <span className="w-9 shrink-0 text-[10px] font-black uppercase text-muted-foreground">
                  {r.position === "DEF" ? "DST" : r.position}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{r.name}</span>
                {pts && (
                  <span className="shrink-0 text-[11px] font-bold tabular-nums text-muted-foreground">
                    {pts.projection.toFixed(1)}
                  </span>
                )}
                {unmatched && (
                  <span
                    className="shrink-0 rounded bg-chart-4/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-tight text-chart-4"
                    title="Not matched to a real player record — scored with a generic replacement-level baseline instead of this player's actual stats. Pick a name from the search suggestions above, or re-import with the position included, for an accurate score."
                  >
                    Unmatched
                    <span className="sr-only">
                      , not matched to a real player — scored with a generic baseline
                    </span>
                  </span>
                )}
                <button
                  type="button"
                  aria-pressed={r.starter}
                  aria-label={`Set ${r.name} as ${r.starter ? "a bench player" : "a starter"}`}
                  onClick={() =>
                    onChange(roster.map((x) => (x.id === r.id ? { ...x, starter: !x.starter } : x)))
                  }
                  className={cn(
                    "rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-tight",
                    r.starter ? "bg-action/15 text-turf" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {r.starter ? "Starter" : "Bench"}
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${r.name}`}
                  onClick={() => {
                    onChange(roster.filter((x) => x.id !== r.id));
                    toast.info(`Removed ${r.name} from your roster.`);
                  }}
                  className="text-muted-foreground"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Paywall({ format }: { format: "std" | "half" | "ppr" }) {
  return (
    <Page format={format}>
      <ProFeatureSection
        icon={<ClipboardList aria-hidden="true" className="size-7" strokeWidth={2.5} />}
        title="Team Analyzer"
        description="Enter your roster once and Wire Tap flags your weakest spots every week, with the math shown — plus injury alerts and a suggested lineup."
        benefits={[
          {
            title: "Weakness scoring",
            body: "Every position scored against replacement level, math shown.",
          },
          {
            title: "Ranked verdict",
            body: "\u201cYour weakest positions are RB, then TE\u201d — prioritized for you.",
          },
          {
            title: "Injury alerts",
            body: "Live alerts with the best legal replacement named.",
          },
          {
            title: "Reusable profile",
            body: "Lineup slots and bench size saved — set once, use all season.",
          },
        ]}
        preview={
          <>
            <p className="text-[10px] font-black uppercase tracking-wider">Verdict</p>
            <p className="font-display text-2xl uppercase leading-none">
              Weakest: RB, then WR (42)
            </p>
            <p className="text-xs opacity-80">
              Your RB room scores 18 points below replacement level over the next 4 weeks.
            </p>
            <div className="space-y-1.5 pt-1">
              {[
                ["RB", "42%"],
                ["WR", "58%"],
                ["TE", "71%"],
              ].map(([slot, width]) => (
                <div key={slot} className="flex items-center gap-2 text-xs">
                  <span className="w-8 font-bold">{slot}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <span className="block h-full rounded-full bg-chart-4" style={{ width }} />
                  </span>
                </div>
              ))}
            </div>
          </>
        }
        feature="Team Analyzer"
      />
      <p className="px-1 text-xs">
        <Link to="/" className="font-bold text-turf underline">
          Keep browsing free waiver targets
        </Link>
      </p>
    </Page>
  );
}
