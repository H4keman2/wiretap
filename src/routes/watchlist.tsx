import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FormatSelector } from "@/components/wire/Controls";
import { PlayerRow } from "@/components/wire/PlayerRow";
import { Page, ProxyNote, SectionLabel } from "@/components/wire/Shell";
import { Skeleton } from "@/components/ui/skeleton";
import { useEspnConnection } from "@/lib/league-store";
import type { ScoringFormat } from "@/lib/ranking";
import { cn } from "@/lib/utils";
import { getWatchlistPlayers } from "@/lib/waivers.functions";
import { useWatchlist } from "@/lib/watchlist-store";

export const Route = createFileRoute("/watchlist")({
  head: () => ({
    meta: [
      { title: "Saved Players — Wire Tap Watchlist" },
      {
        name: "description",
        content:
          "Your saved fantasy football waiver targets in one place, with live ownership, projections, trends and strength of schedule refreshed every visit.",
      },
      { property: "og:title", content: "Wire Tap Watchlist — Saved Waiver Targets" },
      {
        property: "og:description",
        content:
          "Track the waiver wire players you care about with live ownership, projections and matchup difficulty.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WatchlistPage,
});

type SortKey = "saved" | "ownership" | "score" | "trend";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "saved", label: "Saved" },
  { key: "ownership", label: "Owned" },
  { key: "score", label: "Score" },
  { key: "trend", label: "Trend" },
];

function WatchlistPage() {
  const [format, setFormat] = useState<ScoringFormat>("ppr");
  const [sort, setSort] = useState<SortKey>("saved");
  const [posFilter, setPosFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const { entries, loaded, clear } = useWatchlist();
  // Focus target after "Clear all": the empty-state card, so keyboard focus
  // doesn't fall to <body> when the dialog's trigger unmounts.
  const emptyStateRef = useRef<HTMLDivElement>(null);
  const { connection, loaded: connectionLoaded } = useEspnConnection();
  // Once a format is picked in the selector below, that choice wins.
  const [formatChosen, setFormatChosen] = useState(false);
  // The list waits on this so it never fetches in a format about to change.
  const [formatReady, setFormatReady] = useState(false);
  const appliedLeagueFormat = useRef(false);
  const ids = entries.map((e) => e.id);

  // A connected league dictates scoring, so start from its format rather than
  // the PPR fallback. Applied once as a default only — it never replaces a
  // format the user has already selected here. Once the league has been read,
  // `formatReady` opens the gate on the list below, so it never loads in a
  // format that is about to be replaced.
  useEffect(() => {
    if (!connectionLoaded || appliedLeagueFormat.current) return;
    appliedLeagueFormat.current = true;
    const leagueFormat = connection.summary?.format;
    if (leagueFormat && !formatChosen) setFormat(leagueFormat);
    setFormatReady(true);
  }, [connectionLoaded, connection.summary?.format, formatChosen]);

  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ["watchlist", format, ids.join(",")],
    queryFn: () => getWatchlistPlayers({ data: { ids, format } }),
    enabled: loaded && ids.length > 0 && formatReady,
    staleTime: 1000 * 60 * 10,
  });

  const q = search.trim().toLowerCase();
  const positions = Array.from(new Set((data ?? []).map((p) => p.position)));
  const visible = (data ?? [])
    .filter((p) => posFilter === "ALL" || p.position === posFilter)
    .filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.position.toLowerCase().includes(q) ||
        (p.team ?? "").toLowerCase().includes(q),
    )
    .sort((a, b) => {
      if (sort === "ownership") return a.ownership - b.ownership;
      if (sort === "score") return b.score - a.score;
      if (sort === "trend") return b.trendDelta - a.trendDelta;
      return 0;
    });

  return (
    <Page format={format}>
      <section className="space-y-1">
        <h1 className="font-display text-3xl uppercase leading-none">Watchlist</h1>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Players you saved, refreshed with live ownership, projections and matchups. Stored on this
          device — no account needed.
        </p>
        <Link
          to="/analyzer"
          className="inline-flex w-fit items-center gap-1 pt-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground underline underline-offset-4 transition-colors hover:text-action"
        >
          Analyze my roster
        </Link>
      </section>

      <FormatSelector
        value={format}
        onChange={(v) => {
          setFormatChosen(true);
          setFormatReady(true);
          setFormat(v);
        }}
      />

      {(data?.length ?? 0) > 0 && (
        <section className="space-y-2 rounded-xl border border-border bg-card p-3">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Search className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
            </span>
            <input
              type="search"
              inputMode="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && search.length > 0) {
                  e.preventDefault();
                  setSearch("");
                }
              }}
              placeholder="Search saved players by name, team or position…"
              aria-label="Search saved players"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-9 text-xs font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-action"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
              </button>
            )}
          </div>

          <div role="group" aria-label="Sort by" className="space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Sort by
            </p>
            <div className="flex flex-wrap gap-2">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSort(s.key)}
                  aria-pressed={sort === s.key}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-tight transition-colors",
                    sort === s.key
                      ? "border-action bg-action text-action-foreground"
                      : "border-border bg-background text-muted-foreground",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div role="group" aria-label="Position" className="space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Position
            </p>
            <div className="flex flex-wrap gap-2">
              {["ALL", ...positions].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPosFilter(p)}
                  aria-pressed={posFilter === p}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-tight transition-colors",
                    posFilter === p
                      ? "border-action bg-action text-action-foreground"
                      : "border-border bg-background text-muted-foreground",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionLabel>
            {visible.length === entries.length
              ? `${entries.length} saved`
              : `${visible.length} of ${entries.length} saved`}
          </SectionLabel>
          {entries.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  className="text-[10px] font-black uppercase tracking-wider text-muted-foreground underline"
                >
                  Clear all
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear your whole watchlist?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes all {entries.length} saved player{entries.length === 1 ? "" : "s"}{" "}
                    from this device. There's no undo — you'd have to re-save them one by one.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      clear();
                      toast.info("Watchlist cleared.");
                      requestAnimationFrame(() => emptyStateRef.current?.focus());
                    }}
                  >
                    Clear all
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {loaded && entries.length === 0 && (
          <div
            ref={emptyStateRef}
            tabIndex={-1}
            className="rounded-xl border border-border bg-card p-4 outline-none"
          >
            <p className="text-xs text-muted-foreground">
              Nothing saved yet. Tap the star on any player card to add them here.
            </p>
            <Link
              to="/"
              className="mt-3 block w-full rounded bg-action py-2 text-center text-sm font-bold uppercase tracking-tight text-action-foreground"
            >
              Browse waiver targets
            </Link>
          </div>
        )}

        {entries.length > 0 && isPending && (
          <div className="space-y-3">
            <span className="sr-only" role="status">Loading your watchlist…</span>
            {entries.slice(0, 3).map((e) => (
              <Skeleton key={e.id} className="h-28 rounded-xl" aria-hidden="true" />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              Player data is unavailable right now. Try again in a moment.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="mt-3 rounded bg-action px-4 py-2 text-xs font-bold uppercase text-action-foreground disabled:opacity-50"
            >
              Try again
            </button>
          </div>
        )}

        {entries.length > 0 && !isPending && !isError && (data?.length ?? 0) === 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              Your saved players didn't load — try again.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="mt-3 rounded bg-action px-4 py-2 text-xs font-bold uppercase text-action-foreground disabled:opacity-50"
            >
              Try again
            </button>
          </div>
        )}


        {(data?.length ?? 0) > 0 && visible.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {search
                ? `No saved players match “${search}”. Try a different search or clear it.`
                : `No saved ${posFilter} players. Pick a different position filter.`}
            </p>
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="mt-3 block w-full rounded border border-border bg-background py-2 text-center text-sm font-bold uppercase tracking-tight text-foreground"
              >
                Clear search
              </button>
            )}
            {posFilter !== "ALL" && (
              <button
                type="button"
                onClick={() => setPosFilter("ALL")}
                className="mt-3 block w-full rounded border border-border bg-background py-2 text-center text-sm font-bold uppercase tracking-tight text-foreground"
              >
                Show all positions
              </button>
            )}
          </div>
        )}

        <div className="space-y-4">
          {visible.map((player, i) => (
            <PlayerRow key={player.id} player={player} rank={i + 1} format={format} />
          ))}
        </div>

        {entries.length > 0 && <ProxyNote />}
      </section>
    </Page>
  );
}
