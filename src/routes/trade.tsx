import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight, Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { FormatSelector } from "@/components/wire/Controls";
import { Page, ProxyNote, SectionLabel } from "@/components/wire/Shell";
import { ProFeatureSection } from "@/components/wire/ProFeatureSection";
import { SosSection } from "@/components/wire/SosSection";
import { Skeleton } from "@/components/ui/skeleton";
import { FORMAT_LABEL, type ScoringFormat } from "@/lib/ranking";
import { useEspnConnection, usePro } from "@/lib/league-store";
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
  const [active, setActive] = useState(0);
  const listId = useId();
  const { key } = usePro();

  const {
    data: results,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["player-search", query],
    queryFn: () => searchPlayers({ data: { query, licenseKey: key ?? "" } }),
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60 * 5,
  });

  const visible = results?.filter((r) => !exclude.includes(r.id));
  const open = query.trim().length >= 2;

  useEffect(() => {
    setActive(0);
  }, [query, results]);

  const select = (p: NonNullable<typeof visible>[number]) => {
    onAdd(p);
    setQuery("");
  };

  const optionId = (index: number) => `${listId}-option-${index}`;
  const activeId =
    visible && visible.length > 0 ? optionId(Math.min(active, visible.length - 1)) : undefined;

  return (
    <div className="space-y-2">
      <input
        type="search"
        inputMode="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          const count = visible?.length ?? 0;

          if (e.key === "Escape") {
            if (query.length === 0) return;
            e.preventDefault();
            setQuery("");
            return;
          }

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

          if (e.key !== "Enter" || query.trim().length === 0) return;
          const picked = visible?.[Math.min(active, count - 1)];
          if (picked) select(picked);
        }}
        placeholder="Add a player by name…"
        aria-label={`${slotLabel} — add a player`}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={activeId}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium outline-none placeholder:text-muted-foreground/70 focus:border-action"
      />
      {query.trim().length >= 2 && (
        <div className="space-y-1">
          {isFetching && !results && <Skeleton className="h-8 rounded-lg" />}
          {isError && !isFetching && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">
                Couldn't search players — check your connection.
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
          {visible?.length === 0 && (
            <p className="text-[11px] text-muted-foreground">No player matches that name.</p>
          )}
          {visible && visible.length > 0 && (
            <div role="listbox" id={listId} className="space-y-1">
              {visible.map((r, i) => {
                const isActive = i === Math.min(active, visible.length - 1);
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="option"
                    id={optionId(i)}
                    aria-selected={isActive}
                    onClick={() => select(r)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-left",
                      isActive && "bg-secondary ring-1 ring-action",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Plus
                        aria-hidden="true"
                        className="size-3 shrink-0 text-action"
                        strokeWidth={3}
                      />
                      <span className="truncate text-xs font-bold">{r.name}</span>
                    </span>
                    <span className="shrink-0 text-[10px] font-bold uppercase text-muted-foreground">
                      {r.team ?? "FA"} • {r.position}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
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
              <X aria-hidden="true" className="size-4" strokeWidth={3} />
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
  const { isPro, key, loaded: proLoaded } = usePro();
  const { connection, loaded: connectionLoaded } = useEspnConnection();
  // Once a format is picked in the selector below, that choice wins.
  const [formatChosen, setFormatChosen] = useState(false);
  const appliedLeagueFormat = useRef(false);

  // A connected league dictates scoring, so start from its format rather than
  // the PPR fallback. Applied once as a default only — it never replaces a
  // format the user has already selected here.
  useEffect(() => {
    if (appliedLeagueFormat.current || formatChosen || !connectionLoaded) return;
    const leagueFormat = connection.summary?.format;
    if (!leagueFormat) return;
    appliedLeagueFormat.current = true;
    setFormat(leagueFormat);
  }, [connectionLoaded, connection.summary?.format, formatChosen]);

  const ids = [...a, ...b].map((p) => p.id);
  const both = a.length > 0 && b.length > 0;

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ["trade", format, ids.join(",")],
    queryFn: () =>
      getWatchlistPlayers({ data: { ids, format, licenseKey: key ?? "", requirePro: true } }),
    enabled: both && isPro,
    staleTime: 1000 * 60 * 10,
  });

  const sideA = a.map((p) => data?.find((d) => d.id === p.id)).filter((p) => !!p);
  const sideB = b.map((p) => data?.find((d) => d.id === p.id)).filter((p) => !!p);
  const ready = both && !!data && sideA.length === a.length && sideB.length === b.length;
  const analysis = ready ? analyzeTrade(sideA, sideB, format) : null;

  const colorA = teamColor(a[0]?.team ?? null);
  const colorB = teamColor(b[0]?.team ?? null);

  if (!proLoaded) {
    return (
      <Page format={format}>
        <Skeleton className="h-64 w-full" />
      </Page>
    );
  }

  if (!isPro) {
    return (
      <Page format={format}>
        <ProFeatureSection
          icon={<ArrowLeftRight aria-hidden="true" className="size-7" strokeWidth={2.5} />}
          title="Trade Analyzer"
          description="Stack players on each side and get a data-backed verdict on any trade — projections, rostered %, proven production, momentum, and upcoming matchups compared side by side."
          benefits={[
            {
              title: "Verdict up front",
              body: "Win, lose, or even — with the math shown, not a gut feel.",
            },
            {
              title: "Side-by-side metrics",
              body: "Projections, rostered %, production, and momentum compared line by line.",
            },
            {
              title: "Schedule-aware",
              body: "Upcoming matchups factor into every comparison.",
            },
            {
              title: "Any package size",
              body: "1-for-1 swaps or full multi-player blockbusters.",
            },
          ]}
          preview={
            <>
              <p className="text-[10px] font-black uppercase tracking-wider">Verdict</p>
              <p className="font-display text-2xl uppercase leading-none">You win this trade</p>
              <p className="text-xs opacity-80">
                Your side outscores theirs by 4.2 pts/week on projections with the softer upcoming
                schedule.
              </p>
              <div className="space-y-1.5 pt-1">
                {["Projections", "Rostered %", "Momentum"].map((label) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span className="font-bold">{label}</span>
                    <span className="h-1.5 w-24 rounded-full bg-secondary" />
                  </div>
                ))}
              </div>
            </>
          }
          feature="Trade Analyzer"
        />
      </Page>
    );
  }

  return (
    <Page format={format}>
      <section className="space-y-1">
        <h1 className="flex items-center gap-2 font-display text-3xl uppercase leading-none">
          <ArrowLeftRight aria-hidden="true" className="size-7 text-action" strokeWidth={2.5} />
          Trade Analyzer
        </h1>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Stack any number of players on each side — 1-for-1 or a full package — and compare
          projections, rostered %, proven production, momentum and upcoming matchups.
        </p>
      </section>

      <FormatSelector
        value={format}
        onChange={(v) => {
          setFormatChosen(true);
          setFormat(v);
        }}
      />

      <section className="space-y-3">
        <SectionLabel>The two sides</SectionLabel>
        <SidePicker slotLabel="You give up" players={a} exclude={ids} onChange={setA} />
        <div className="flex items-center justify-center">
          <span className="rounded-full border border-border bg-card p-2 text-muted-foreground">
            <ArrowLeftRight aria-hidden="true" className="size-4" strokeWidth={3} />
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
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            Player data is unavailable right now. Try again in a moment.
          </p>
          <button
            className="mt-2 rounded bg-action px-4 py-2 text-xs font-bold uppercase text-action-foreground disabled:opacity-50"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            Try again
          </button>
        </div>
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
