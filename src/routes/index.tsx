import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { FormatSelector, OwnershipSlider, PositionSelector } from "@/components/wire/Controls";
import { PlayerRow } from "@/components/wire/PlayerRow";
import { Page, ProxyNote, SectionLabel } from "@/components/wire/Shell";
import { Skeleton } from "@/components/ui/skeleton";
import type { ScoringFormat, SlotPosition } from "@/lib/ranking";
import { getRecommendations } from "@/lib/waivers.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wire Tap — Fantasy Football Waiver Wire Targets" },
      {
        name: "description",
        content:
          "Browse ranked fantasy football waiver wire pickups by position and scoring format, filtered by how widely rostered each player is. No league login required.",
      },
      { property: "og:title", content: "Wire Tap — Waiver Wire Targets by Position" },
      {
        property: "og:description",
        content:
          "Ranked waiver pickups by position, scoring format, and availability threshold. Works with Sleeper, ESPN, Yahoo and NFL.com leagues.",
      },
    ],
  }),
  component: WaiverBrowser,
});

function WaiverBrowser() {
  const [format, setFormat] = useState<ScoringFormat>("ppr");
  const [slot, setSlot] = useState<SlotPosition>("RB");
  const [maxOwnership, setMaxOwnership] = useState(40);

  const { data, isPending, isError } = useQuery({
    queryKey: ["waivers", format, slot, maxOwnership],
    queryFn: () => getRecommendations({ data: { format, slot, maxOwnership } }),
    staleTime: 1000 * 60 * 10,
  });

  return (
    <Page format={format}>
      <section className="relative overflow-hidden rounded-xl border-b-4 border-action bg-depth p-4 text-depth-foreground">
        <div className="relative z-10">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-action px-1.5 py-0.5 text-[10px] font-black text-action-foreground">
              PRO FEATURE
            </span>
            <h2 className="text-sm font-bold uppercase tracking-wide text-action">Team Analyzer</h2>
          </div>
          <p className="mb-2 font-display text-2xl uppercase leading-none">
            Want to know which position YOUR team needs?
          </p>
          <p className="mb-4 max-w-[240px] text-xs text-depth-foreground/60">
            Enter your roster once and Wire Tap flags your weakest spots every week, with the math
            shown.
          </p>
          <Link
            to="/analyzer"
            className="block w-full rounded bg-card py-2 text-center text-sm font-bold uppercase tracking-tight text-foreground"
          >
            Analyze my roster
          </Link>
        </div>
        <div className="absolute -bottom-5 -right-5 size-32 rounded-full border border-depth-foreground/5" />
        <div className="absolute -bottom-10 -right-10 size-48 rounded-full border border-depth-foreground/5" />
      </section>

      <section className="space-y-4">
        <FormatSelector value={format} onChange={setFormat} />
        <PositionSelector value={slot} onChange={setSlot} />
        <OwnershipSlider value={maxOwnership} onChange={setMaxOwnership} />
      </section>

      <section className="space-y-3">
        <SectionLabel>Top {slot} targets</SectionLabel>

        {isPending && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        )}

        {isError && (
          <p className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
            Player data is unavailable right now. Try again in a moment.
          </p>
        )}

        {data?.length === 0 && (
          <p className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
            No {slot} options under {maxOwnership}% rostered. Raise the threshold to widen the pool.
          </p>
        )}

        {data?.map((player, i) => <PlayerRow key={player.id} player={player} rank={i + 1} />)}

        <ProxyNote />
      </section>
    </Page>
  );
}
