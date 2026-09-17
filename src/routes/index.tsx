import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { FormatSelector, OwnershipSlider, PositionSelector } from "@/components/wire/Controls";
import { LIVE_REFRESH_MS, LiveStatusNote, useLiveWatch } from "@/components/wire/LiveWatch";
import { PlayerRow } from "@/components/wire/PlayerRow";

import { Hero, HowItWorks } from "@/components/wire/Hero";
import { OwnershipCompare } from "@/components/wire/OwnershipCompare";
import { Page, ProxyNote, SectionLabel } from "@/components/wire/Shell";
import { SosWarning } from "@/components/wire/SosWarning";
import { Skeleton } from "@/components/ui/skeleton";
import { useEspnConnection } from "@/lib/league-store";
import { useLiveUpdates } from "@/lib/live-updates-store";

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
  const { enabled: live } = useLiveUpdates();
  const { connection, cred } = useEspnConnection();

  // A connected league dictates scoring — its own settings beat a guess.
  const leagueFormat = cred ? connection.summary?.format : null;
  const activeFormat = leagueFormat ?? format;

  const { data, isPending, isError, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["waivers", activeFormat, slot, maxOwnership, cred?.leagueId ?? "national"],
    queryFn: () =>
      getRecommendations({
        data: { format: activeFormat, slot, maxOwnership, league: cred },
      }),
    staleTime: live ? 0 : 1000 * 60 * 10,
    refetchInterval: live ? LIVE_REFRESH_MS : false,
    refetchIntervalInBackground: false,
  });

  const { newIds, lastUpdate } = useLiveWatch(
    data,
    `${activeFormat}|${slot}|${maxOwnership}|${cred?.leagueId ?? ""}`,
    live,
  );

  // The schedule week the SOS window currently opens on — the honest answer to
  // "is this current?", read off the data itself rather than a second fetch.
  const week = data?.find((p) => p.sos?.matchups?.length)?.sos?.matchups?.[0]?.week ?? null;

  return (
    <Page format={activeFormat}>
      <SosWarning />

      <Hero week={week} poolSize={data?.length ?? null} updatedAt={dataUpdatedAt} />

      <HowItWorks />


      <section className="space-y-5">
        {cred && connection.summary ? (
          <div className="rounded-xl border border-action/50 bg-card p-4">
            <p className="text-sm font-bold">{connection.summary.name}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Showing only players free in your league, scored with your league's{" "}
              {connection.summary.size}-team {activeFormat === "std" ? "standard" : activeFormat}{" "}
              settings.{" "}
              <Link to="/settings" className="font-bold text-turf underline">
                Change league
              </Link>
            </p>
          </div>
        ) : (
          <>
            <FormatSelector value={format} onChange={setFormat} />
            <OwnershipSlider value={maxOwnership} onChange={setMaxOwnership} />
          </>
        )}
        <PositionSelector value={slot} onChange={setSlot} />
        <LiveStatusNote
          enabled={live}
          isFetching={isFetching}
          lastUpdate={lastUpdate}
          newCount={newIds.size}
        />
      </section>

      <section className="space-y-4">
        <SectionLabel>
          {cred
            ? `${slot} free agents in your league`
            : `All ${slot} targets under ${maxOwnership}% owned`}
        </SectionLabel>


        {isPending && (
          <div className="space-y-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        )}

        {isError && (
          <p className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
            {cred
              ? "Couldn't read your league just now — check your league details in Settings, or try again in a moment."
              : "Player data is unavailable right now. Try again in a moment."}
          </p>
        )}

        {data?.length === 0 && (
          <p className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
            {cred
              ? `Every ${slot} is already rostered in your league right now.`
              : `No ${slot} options under ${maxOwnership}% rostered. Raise the threshold to widen the pool.`}
          </p>
        )}


        <OwnershipCompare
          players={data}
          connected={!!cred}
          leagueName={connection.summary?.name ?? null}
        />

        <div className="space-y-4">
          {data?.map((player, i) => (
            <PlayerRow
              key={player.id}
              player={player}
              rank={i + 1}
              format={format}
              isNew={newIds.has(player.id)}
            />
          ))}
        </div>

        <section className="rounded-xl border-b-4 border-action bg-depth p-5 text-depth-foreground">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded bg-action px-1.5 py-0.5 text-[10px] font-black text-action-foreground">
              PRO
            </span>
            <h2 className="text-sm font-bold uppercase tracking-wide text-action">Team Analyzer</h2>
          </div>
          <p className="mb-2 font-display text-xl uppercase leading-none">
            Which position does YOUR team need?
          </p>
          <p className="mb-4 text-xs leading-relaxed text-depth-foreground/75">
            Enter your roster once and Wire Tap flags your weakest spots every week, with the math
            shown — plus injury alerts and a suggested lineup.
          </p>
          <Link
            to="/analyzer"
            className="block w-full rounded bg-action py-3 text-center text-sm font-bold uppercase tracking-tight text-action-foreground"
          >
            Analyze my roster
          </Link>
        </section>

        <ProxyNote />
      </section>
    </Page>
  );
}
