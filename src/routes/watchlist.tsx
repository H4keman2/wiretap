import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { FormatSelector } from "@/components/wire/Controls";
import { PlayerRow } from "@/components/wire/PlayerRow";
import { Page, ProxyNote, SectionLabel } from "@/components/wire/Shell";
import { Skeleton } from "@/components/ui/skeleton";
import type { ScoringFormat } from "@/lib/ranking";
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

function WatchlistPage() {
  const [format, setFormat] = useState<ScoringFormat>("ppr");
  const { entries, loaded, clear } = useWatchlist();
  const ids = entries.map((e) => e.id);

  const { data, isPending, isError } = useQuery({
    queryKey: ["watchlist", format, ids.join(",")],
    queryFn: () => getWatchlistPlayers({ data: { ids, format } }),
    enabled: loaded && ids.length > 0,
    staleTime: 1000 * 60 * 10,
  });

  return (
    <Page format={format}>
      <section className="space-y-1">
        <h1 className="font-display text-3xl uppercase leading-none">Watchlist</h1>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Players you saved, refreshed with live ownership, projections and matchups. Stored on this
          device — no account needed.
        </p>
      </section>

      <FormatSelector value={format} onChange={setFormat} />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionLabel>{entries.length} saved</SectionLabel>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={clear}
              className="text-[10px] font-black uppercase tracking-wider text-muted-foreground underline"
            >
              Clear all
            </button>
          )}
        </div>

        {loaded && entries.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
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
            {entries.slice(0, 3).map((e) => (
              <Skeleton key={e.id} className="h-28 rounded-xl" />
            ))}
          </div>
        )}

        {isError && (
          <p className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
            Player data is unavailable right now. Try again in a moment.
          </p>
        )}

        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
          {data?.map((player, i) => (
            <PlayerRow key={player.id} player={player} rank={i + 1} format={format} />
          ))}
        </div>

        {entries.length > 0 && <ProxyNote />}
      </section>
    </Page>
  );
}
