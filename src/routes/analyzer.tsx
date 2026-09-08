import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Lock, Plus, Shield, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { FormatSelector, OwnershipSlider, PositionSelector } from "@/components/wire/Controls";
import { PlayerRow } from "@/components/wire/PlayerRow";
import { Page, ProxyNote, SectionLabel } from "@/components/wire/Shell";
import { SosWarning } from "@/components/wire/SosWarning";
import { useLeagueProfile, usePro } from "@/lib/league-store";
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
  const [maxOwnership, setMaxOwnership] = useState(40);
  const [override, setOverride] = useState<SlotPosition | null>(null);

  const analysis = useMutation({ mutationFn: analyzeTeam });

  const roster = profile.roster;
  const starters = useMemo(() => roster.filter((r) => r.starter), [roster]);
  const fill = useMemo(() => lineupFill(roster, profile.config), [roster, profile.config]);

  useEffect(() => {
    if (!loaded || !isPro || !key || roster.length === 0) return;
    analysis.mutate({
      data: {
        format: profile.format,
        config: profile.config,
        roster,
        maxOwnership,
        overrideSlot: override,
        licenseKey: key,
      },
    });
    // Server re-verifies the license on every call regardless of client state,
    // so a stale or revoked key here simply results in a PRO_REQUIRED error.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, isPro, key, roster, profile.format, profile.config, maxOwnership, override]);

  if (!proLoaded || !loaded) {
    return (
      <Page format={profile.format}>
        <Skeleton className="h-40 rounded-xl" />
      </Page>
    );
  }

  if (!isPro) return <Paywall format={profile.format} />;

  const result = analysis.data;

  return (
    <Page format={profile.format}>
      <SosWarning />
      <section className="space-y-3">
        <SectionLabel>Scoring format</SectionLabel>
        <FormatSelector value={profile.format} onChange={(format) => update({ format })} />
        <p className="px-1 text-[11px] text-muted-foreground">
          Starting lineup and bench size live in{" "}
          <Link to="/settings" className="font-bold text-turf underline">
            League settings
          </Link>{" "}
          — every league's slots are different (3 starting WR, 2 FLEX, whatever yours runs), so
          set it there once and it applies here automatically.
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
          <section className="relative overflow-hidden rounded-xl border-b-4 border-action bg-depth p-4 text-depth-foreground">
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
              ({result.verdicts[0]?.score})
            </p>
            <p className="text-xs text-depth-foreground/75">{result.verdicts[0]?.reasons[0]}</p>
          </section>

          <section className="space-y-2">
            <SectionLabel>Positional strength</SectionLabel>
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {result.verdicts.map((v) => (
                <details key={v.slot} className="group px-3 py-2.5">
                  <summary className="flex cursor-pointer items-center gap-3 list-none">
                    <span className="w-12 font-display text-lg uppercase">{v.slot}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
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

          {result.handcuffs.length > 0 && (
            <section className="space-y-2">
              <SectionLabel>Handcuffs available</SectionLabel>
              <p className="px-1 text-[11px] text-muted-foreground">
                The direct backup behind one of your starters — cheap insurance if that starter
                gets hurt, and often only valuable to whoever owns the starter.
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
            <SectionLabel>Override position</SectionLabel>
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
              <p className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
                Nothing under {maxOwnership}% rostered at {result.targetSlot}. Raise the threshold.
              </p>
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

      {analysis.isPending && <Skeleton className="h-28 rounded-xl" />}

      {analysis.isError && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
          {String(analysis.error).includes("PRO_REQUIRED")
            ? "Your license couldn't be verified. Check your key in League settings."
            : "Something went wrong running the analysis. Try again in a moment."}
        </p>
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
  const [position, setPosition] = useState<RealPosition>("RB");
  const [options, setOptions] = useState<
    Array<{ id: string; name: string; team: string | null; position: string }>
  >([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      searchPlayers({ data: { query } })
        .then((rows) => {
          if (!cancelled) setOptions(rows);
        })
        .catch(() => setOptions([]));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const add = (entry: Omit<RosterEntry, "starter">) => {
    if (roster.some((r) => r.id === entry.id)) return;
    const starter = suggestStarterDefault(roster, entry.position, config);
    onChange([...roster, { ...entry, starter }]);
    setQuery("");
    setOptions([]);
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
          onClick={() => setBulkOpen((v) => !v)}
          className="text-[11px] font-bold text-turf underline"
        >
          {bulkOpen ? "Add one at a time instead" : "Paste in your whole roster"}
        </button>
      </div>

      {bulkOpen ? (
        <div className="space-y-2 rounded-xl border border-border bg-card p-3">
          <Textarea
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
              placeholder="Add player by name"
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
              className="h-9 shrink-0"
              onClick={() =>
                query.trim() &&
                add({
                  id: `manual-${query.trim().toLowerCase()}`,
                  name: query.trim(),
                  position,
                })
              }
            >
              <Plus className="size-4" />
            </Button>
          </div>

          {options.length > 0 && (
            <ul className="mt-2 divide-y divide-border overflow-hidden rounded-md border border-border">
              {options.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-bold hover:bg-secondary"
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
                  </span>
                )}
                <button
                  type="button"
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
                  onClick={() => onChange(roster.filter((x) => x.id !== r.id))}
                  className="text-muted-foreground"
                >
                  <Trash2 className="size-4" />
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
      <section className="relative overflow-hidden rounded-xl border-b-4 border-action bg-depth p-5 text-depth-foreground">
        <Lock className="mb-3 size-6 text-action" />
        <p className="font-display text-3xl uppercase leading-none">Team Analyzer is Pro</p>
        <p className="mt-2 text-xs text-depth-foreground/75">
          Roster entry, positional weakness scoring, and auto-flagged weak spots. Season pass or
          weekly, cancel whenever.
        </p>
        <Link
          to="/settings"
          className="mt-4 block w-full rounded bg-action py-2 text-center text-sm font-bold uppercase tracking-tight text-action-foreground"
        >
          Enter license key
        </Link>
      </section>
      <section className="space-y-2 rounded-xl border border-border bg-card p-4">
        <SectionLabel>What you get</SectionLabel>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li>• Reusable league profile — lineup slots and bench size saved.</li>
          <li>• Every position scored against replacement level, math shown.</li>
          <li>• Ranked list: "Your weakest positions are RB, then TE".</li>
          <li>• Manual position override inside the analysis.</li>
        </ul>
        <Link to="/" className="block pt-2 text-xs font-bold text-turf underline">
          Keep browsing free waiver targets
        </Link>
      </section>
    </Page>
  );
}
