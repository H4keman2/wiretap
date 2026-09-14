import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight, Plus, X } from "lucide-react";
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
      { title: "Trade Analyzer — Compare Multi-Player Fantasy Trades" },
      {
        name: "description",
        content:
          "Compare fantasy football trades of any size side by side on projections, rostered percentage, last-season production, trend and strength of schedule before you send the offer.",
      },
      { property: "og:title", content: "Wire Tap Trade Analyzer" },
      {
        property: "og:description",
        content:
          "Multi-player trade comparison with a clear verdict on which side of the deal wins.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TradePage,
});

type Pick = { id: string; name: string; team: string | null; position: string };

function PlayerSearch({
  slotLabel,
  exclude,
  onAdd,
}: {
  slotLabel: string;
  exclude: string[];
  onAdd: (p: Pick) => void;
}) {
  const [query, setQuery] = useState("");

  const { data: results, isFetching } = useQuery({
    queryKey: ["player-search", query],
    queryFn: () => searchPlayers({ data: { query } }),
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60 * 5,
  });

  const visible = results?.filter((r) => !exclude.includes(r.id));

  return (
    <div className="space-y-2">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Add a player by name…"
        aria-label={`${slotLabel} — add a player`}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium outline-none placeholder:text-muted-foreground/70 focus:border-action"
      />
      {query.trim().length >= 2 && (
        <div className="space-y-1">
          {isFetching && !results && <Skeleton className="h-8 rounded-lg" />}
          {visible?.length === 0 && (
            <p className="text-[11px] text-muted-foreground">No player matches that name.</p>
          )}
          {visible?.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                onAdd(r);
                setQuery("");
              }}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-left"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <Plus className="size-3 shrink-0 text-action" strokeWidth={3} />
                <span className="truncate text-xs font-bold">{r.name}</span>
              </span>
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

function SidePicker({
  slotLabel,
  players,
  exclude,
  onChange,
}: {
  slotLabel: string;
  players: Pick[];
  exclude: string[];
  onChange: (p: Pick[]) => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
          {slotLabel}
        </p>
        <p className="text-[9px] font-bold uppercase text-muted-foreground">
          {players.length === 0
            ? "No players yet"
            : `${players.length} player${players.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {players.map((p) => {
        const color = teamColor(p.team);
        return (
          <div
            key={p.id}
            className="flex items-center justify-between gap-2 rounded-lg border-2 bg-background p-2.5"
            style={{ borderColor: color, boxShadow: `0 0 0 1px ${color}44` }}
          >
            <div className="min-w-0">
              <p className="truncate font-display text-base uppercase leading-none">{p.name}</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                {p.team ?? "Free agent"} • {p.position}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChange(players.filter((x) => x.id !== p.id))}
              aria-label={`Remove ${p.name}`}
              className="shrink-0 rounded-lg border border-border p-1.5 text-muted-foreground"
            >
              <X className="size-4" strokeWidth={3} />
            </button>
          </div>
        );
      })}

      <PlayerSearch
        slotLabel={slotLabel}
        exclude={exclude}
        onAdd={(p) => onChange([...players, p])}
      />
    </div>
  );
}

function TradePage() {
  const [format, setFormat] = useState<ScoringFormat>("ppr");
  const [a, setA] = useState<Pick[]>([]);
  const [b, setB] = useState<Pick[]>([]);

  const ids = [...a, ...b].map((p) => p.id);
  const both = a.length > 0 && b.length > 0;

  const { data, isPending, isError } = useQuery({
    queryKey: ["trade", format, ids.join(",")],
    queryFn: () => getWatchlistPlayers({ data: { ids, format } }),
    enabled: both,
    staleTime: 1000 * 60 * 10,
  });

  const sideA = a.map((p) => data?.find((d) => d.id === p.id)).filter((p) => !!p);
  const sideB = b.map((p) => data?.find((d) => d.id === p.id)).filter((p) => !!p);
  const ready = both && !!data && sideA.length === a.length && sideB.length === b.length;
  const analysis = ready ? analyzeTrade(sideA, sideB, format) : null;

  const colorA = teamColor(a[0]?.team ?? null);
  const colorB = teamColor(b[0]?.team ?? null);

  return (
    <Page format={format}>
      <section className="space-y-1">
        <h1 className="font-display text-3xl uppercase leading-none">Trade Analyzer</h1>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Stack any number of players on each side — 1-for-1 or a full package — and compare
          projections, rostered %, proven production, momentum and upcoming matchups.
        </p>
      </section>

      <FormatSelector value={format} onChange={setFormat} />

      <section className="space-y-3">
        <SectionLabel>The two sides</SectionLabel>
        <SidePicker slotLabel="You give up" players={a} exclude={ids} onChange={setA} />
        <div className="flex items-center justify-center">
          <span className="rounded-full border border-border bg-card p-2 text-muted-foreground">
            <ArrowLeftRight className="size-4" strokeWidth={3} />
          </span>
        </div>
        <SidePicker slotLabel="You get back" players={b} exclude={ids} onChange={setB} />
      </section>

      {!both && (
        <p className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
          Add at least one player to each side to see the comparison and a verdict.
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

      {both && data && !ready && (
        <p className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
          One of those players has no current data — swap him out to compare.
        </p>
      )}

      {analysis && (
        <>
          <section
            className={cn(
              "rounded-xl border-2 p-4",
              analysis.verdict.side === "even"
                ? "border-border bg-card"
                : "bg-depth text-depth-foreground",
            )}
            style={
              analysis.verdict.side === "even"
                ? undefined
                : { borderColor: analysis.verdict.side === "a" ? colorA : colorB }
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
                  {sideA.map((p) => p.name).join(" + ")}
                </p>
                <span className="text-[9px] font-black uppercase text-muted-foreground">vs</span>
                <p
                  className="truncate text-right text-[11px] font-black uppercase"
                  style={{ color: colorB }}
                >
                  {sideB.map((p) => p.name).join(" + ")}
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
            {[...sideA, ...sideB].map((p) => (
              <div key={p.id} className="rounded-xl border border-border bg-card p-3">
                <p className="font-display text-base uppercase leading-none">{p.name}</p>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{p.reason}</p>
                <SosSection sos={p.sos} />
              </div>
            ))}
          </section>

          <ProxyNote />
        </>
      )}
    </Page>
  );
}
