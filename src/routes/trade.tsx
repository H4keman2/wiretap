import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight, X } from "lucide-react";
import { useState } from "react";

import { FormatSelector } from "@/components/wire/Controls";
import { Page, ProxyNote, SectionLabel } from "@/components/wire/Shell";
import { SosSection } from "@/components/wire/SosSection";
import { Skeleton } from "@/components/ui/skeleton";
import { FORMAT_LABEL, type ScoringFormat } from "@/lib/ranking";
import { teamColor } from "@/lib/team-colors";
import { analyzeTrade } from "@/lib/trade";
import { cn } from "@/lib/utils";
import { getWatchlistPlayers, searchPlayers } from "@/lib/waivers.functions";

export const Route = createFileRoute("/trade")({
  head: () => ({
    meta: [
      { title: "Trade Analyzer — Compare Two Fantasy Players" },
      {
        name: "description",
        content:
          "Compare any two fantasy football players side by side on projections, rostered percentage, last-season production, trend and strength of schedule before you offer a trade.",
      },
      { property: "og:title", content: "Wire Tap Trade Analyzer" },
      {
        property: "og:description",
        content:
          "Side-by-side player comparison with a clear verdict on which side of the trade wins.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TradePage,
});

type Pick = { id: string; name: string; team: string | null; position: string };

function PlayerPicker({
  slotLabel,
  value,
  onChange,
}: {
  slotLabel: string;
  value: Pick | null;
  onChange: (p: Pick | null) => void;
}) {
  const [query, setQuery] = useState("");

  const { data: results, isFetching } = useQuery({
    queryKey: ["player-search", query],
    queryFn: () => searchPlayers({ data: { query } }),
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60 * 5,
  });

  if (value) {
    const color = teamColor(value.team);
    return (
      <div
        className="flex items-center justify-between gap-2 rounded-xl border-2 bg-card p-3"
        style={{ borderColor: color, boxShadow: `0 0 0 1px ${color}44` }}
      >
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
            {slotLabel}
          </p>
          <p className="truncate font-display text-lg uppercase leading-none">{value.name}</p>
          <p className="mt-0.5 text-[10px] font-bold uppercase text-muted-foreground">
            {value.team ?? "Free agent"} • {value.position}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setQuery("");
          }}
          aria-label={`Remove ${value.name}`}
          className="shrink-0 rounded-lg border border-border p-1.5 text-muted-foreground"
        >
          <X className="size-4" strokeWidth={3} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
        {slotLabel}
      </p>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search a player by name…"
        aria-label={`${slotLabel} — search a player`}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium outline-none placeholder:text-muted-foreground/70 focus:border-action"
      />
      {query.trim().length >= 2 && (
        <div className="space-y-1">
          {isFetching && !results && <Skeleton className="h-8 rounded-lg" />}
          {results?.length === 0 && (
            <p className="text-[11px] text-muted-foreground">No player matches that name.</p>
          )}
          {results?.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onChange(r)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-left"
            >
              <span className="truncate text-xs font-bold">{r.name}</span>
              <span className="shrink-0 text-[10px] font-bold uppercase text-muted-foreground">
                {r.team ?? "FA"} • {r.position}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TradePage() {
  const [format, setFormat] = useState<ScoringFormat>("ppr");
  const [a, setA] = useState<Pick | null>(null);
  const [b, setB] = useState<Pick | null>(null);

  const ids = [a?.id, b?.id].filter(Boolean) as string[];
  const both = !!a && !!b;

  const { data, isPending, isError } = useQuery({
    queryKey: ["trade", format, ids.join(",")],
    queryFn: () => getWatchlistPlayers({ data: { ids, format } }),
    enabled: both,
    staleTime: 1000 * 60 * 10,
  });

  const playerA = data?.find((p) => p.id === a?.id) ?? null;
  const playerB = data?.find((p) => p.id === b?.id) ?? null;
  const analysis = playerA && playerB ? analyzeTrade(playerA, playerB, format) : null;

  const colorA = teamColor(playerA?.team ?? a?.team ?? null);
  const colorB = teamColor(playerB?.team ?? b?.team ?? null);

  return (
    <Page format={format}>
      <section className="space-y-1">
        <h1 className="font-display text-3xl uppercase leading-none">Trade Analyzer</h1>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Put two players head to head on projections, rostered %, proven production, momentum and
          upcoming matchups — then trade before the wire moves.
        </p>
      </section>

      <FormatSelector value={format} onChange={setFormat} />

      <section className="space-y-3">
        <SectionLabel>The two sides</SectionLabel>
        <PlayerPicker slotLabel="You give up" value={a} onChange={setA} />
        <div className="flex items-center justify-center">
          <span className="rounded-full border border-border bg-card p-2 text-muted-foreground">
            <ArrowLeftRight className="size-4" strokeWidth={3} />
          </span>
        </div>
        <PlayerPicker slotLabel="You get back" value={b} onChange={setB} />
      </section>

      {!both && (
        <p className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
          Pick a player on each side to see the comparison and a verdict.
        </p>
      )}

      {both && isPending && (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      )}

      {both && isError && (
        <p className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
          Player data is unavailable right now. Try again in a moment.
        </p>
      )}

      {both && data && (!playerA || !playerB) && (
        <p className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
          One of those players has no current data — pick someone else to compare.
        </p>
      )}

      {analysis && playerA && playerB && (
        <>
          <section
            className={cn(
              "rounded-xl border-2 p-4",
              analysis.verdict.side === "even" ? "border-border bg-card" : "bg-depth text-depth-foreground",
            )}
            style={
              analysis.verdict.side === "even"
                ? undefined
                : {
                    borderColor: analysis.verdict.side === "a" ? colorA : colorB,
                  }
            }
          >
            <p className="text-[10px] font-black uppercase tracking-wider text-action">Verdict</p>
            <p className="mt-1 font-display text-2xl uppercase leading-none">
              {analysis.verdict.headline}
            </p>
            <p className="mt-2 text-xs leading-relaxed opacity-80">{analysis.verdict.detail}</p>
          </section>

          <section className="space-y-2">
            <SectionLabel>Side by side · {FORMAT_LABEL[format]}</SectionLabel>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border px-3 py-2">
                <p className="truncate text-[11px] font-black uppercase" style={{ color: colorA }}>
                  {playerA.name}
                </p>
                <span className="text-[9px] font-black uppercase text-muted-foreground">vs</span>
                <p
                  className="truncate text-right text-[11px] font-black uppercase"
                  style={{ color: colorB }}
                >
                  {playerB.name}
                </p>
              </div>
              {analysis.metrics.map((m) => (
                <div key={m.label} className="border-b border-border/60 px-3 py-2 last:border-b-0">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <p
                      className={cn(
                        "truncate font-display text-base uppercase leading-none tabular-nums",
                        m.winner === -1 ? "text-turf" : "text-muted-foreground",
                      )}
                    >
                      {m.aText}
                    </p>
                    <p className="text-center text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                      {m.label}
                    </p>
                    <p
                      className={cn(
                        "truncate text-right font-display text-base uppercase leading-none tabular-nums",
                        m.winner === 1 ? "text-turf" : "text-muted-foreground",
                      )}
                    >
                      {m.bText}
                    </p>
                  </div>
                  <p className="mt-1 text-center text-[9px] leading-snug text-muted-foreground/80">
                    {m.hint}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="font-display text-base uppercase leading-none">{playerA.name}</p>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                {playerA.reason}
              </p>
              <SosSection sos={playerA.sos} />
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="font-display text-base uppercase leading-none">{playerB.name}</p>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                {playerB.reason}
              </p>
              <SosSection sos={playerB.sos} />
            </div>
          </section>

          <ProxyNote />
        </>
      )}
    </Page>
  );
}
