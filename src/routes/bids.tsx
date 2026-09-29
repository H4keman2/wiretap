import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, Gavel, Trophy, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PositionSelector } from "@/components/wire/Controls";
import { Page, SectionLabel } from "@/components/wire/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { suggestBid, useBids } from "@/lib/bids";
import { getLeagueBudget } from "@/lib/league.functions";
import { useEspnConnection } from "@/lib/league-store";
import type { RankedPlayer, SlotPosition } from "@/lib/ranking";
import { teamColor } from "@/lib/team-colors";
import { getRecommendations } from "@/lib/waivers.functions";

export const Route = createFileRoute("/bids")({
  head: () => ({
    meta: [
      { title: "Waiver Bid Planner — FAAB Budget & Best Pickup | Wire Tap" },
      {
        name: "description",
        content:
          "See your ESPN league's remaining FAAB budget, the free agents available to you, the best pickup and a suggested bid for each player.",
      },
      { property: "og:title", content: "Wire Tap Waiver Bid Planner" },
      {
        property: "og:description",
        content: "Plan FAAB bids against your real league budget with a suggested amount for every free agent.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BidsPage,
});

function BidsPage() {
  const { connection, cred, loaded } = useEspnConnection();
  const format = connection.summary?.format ?? "ppr";
  const teamId = connection.teamId;
  const [slot, setSlot] = useState<SlotPosition>("RB");
  const { bids, upsert, remove, clear } = useBids();

  const budget = useQuery({
    queryKey: ["league-budget", cred?.leagueId, teamId],
    queryFn: () => getLeagueBudget({ data: { ...cred!, teamId: teamId! } }),
    enabled: !!cred && teamId !== null,
    staleTime: 1000 * 60 * 3,
  });

  const players = useQuery({
    queryKey: ["bid-players", cred?.leagueId, format, slot],
    queryFn: () => getRecommendations({ data: { format, slot, maxOwnership: 101, league: cred } }),
    enabled: !!cred,
    staleTime: 1000 * 60,
  });

  if (!loaded) return <Page format={format}><Skeleton className="h-40 w-full" /></Page>;

  if (!cred || teamId === null) {
    return (
      <Page format={format}>
        <Header />
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="font-bold">Connect your ESPN league first</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Wire Tap reads your budget and your league's free agents from ESPN. Connect your league
            and pick your team in Settings.
          </p>
          <Button asChild className="mt-4">
            <Link to="/settings">Go to Settings</Link>
          </Button>
        </div>
      </Page>
    );
  }

  const b = budget.data;
  const total = b?.total ?? null;
  const remaining = b?.remaining ?? null;
  const planned = bids.reduce((s, x) => s + x.amount, 0);
  const left = remaining === null ? null : remaining - planned;
  const list = (players.data ?? []).slice(0, 15);
  const best = list[0];

  const suggest = (p: RankedPlayer) =>
    total !== null && remaining !== null ? suggestBid(p, total, remaining) : 0;

  const copyAll = async () => {
    const text = bids.map((x) => `${x.name} (${x.position}) — $${x.amount}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Bids copied — enter them in ESPN");
    } catch {
      toast.error("Couldn't copy. Select the list and copy it manually.");
    }
  };

  return (
    <Page format={format}>
      <Header />

      <section className="grid grid-cols-3 gap-3" aria-label="Your budget">
        {budget.isLoading ? (
          <Skeleton className="col-span-3 h-20" />
        ) : budget.isError ? (
          <p className="col-span-3 rounded-xl border border-destructive/40 p-4 text-sm text-destructive">
            {(budget.error as Error).message}
          </p>
        ) : total === null ? (
          <p className="col-span-3 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Your league doesn't use a waiver budget — waivers run by priority order. The best pickup
            below still applies.
          </p>
        ) : (
          <>
            <Stat label="Remaining" value={`$${remaining}`} strong />
            <Stat label="Planned" value={`$${planned}`} />
            <Stat
              label="After bids"
              value={`$${left}`}
              warn={left !== null && left < 0}
            />
          </>
        )}
      </section>
      {b && total !== null && (
        <p className="-mt-5 px-1 text-xs text-muted-foreground">
          {b.teamName} · spent ${b.spent} of ${total} this season
        </p>
      )}

      <div className="space-y-3">
        <SectionLabel>Position</SectionLabel>
        <PositionSelector value={slot} onChange={setSlot} />
      </div>

      {best && (
        <section
          className="rounded-2xl border-2 bg-card p-5"
          style={{ borderColor: teamColor(best.team) }}
          aria-label="Best pickup"
        >
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-action">
            <Trophy className="size-4" /> Best pickup
          </div>
          <p className="mt-2 font-display text-2xl uppercase">{best.name}</p>
          <p className="text-sm text-muted-foreground">
            {best.position} · {best.team ?? "FA"} · {best.projection.toFixed(1)} pts proj · score{" "}
            {best.score.toFixed(1)}
          </p>
          <p className="mt-2 text-sm">{best.reason}</p>
          <BidForm
            player={best}
            suggested={suggest(best)}
            hasBudget={total !== null}
            onSave={(amount) => {
              upsert({ id: best.id, name: best.name, position: best.position, team: best.team, amount, suggested: suggest(best), at: Date.now() });
              toast.success(`Planned $${amount} on ${best.name}`);
            }}
          />
        </section>
      )}

      {bids.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionLabel>Your planned bids</SectionLabel>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copyAll}>
                <Copy className="size-4" /> Copy
              </Button>
              <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
            </div>
          </div>
          <ul className="space-y-2">
            {bids.map((x) => (
              <li key={x.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                <span className="text-sm font-bold">
                  {x.name} <span className="font-normal text-muted-foreground">{x.position}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-display text-lg">${x.amount}</span>
                  <button aria-label={`Remove bid on ${x.name}`} onClick={() => remove(x.id)} className="text-muted-foreground">
                    <X className="size-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <p className="px-1 text-xs text-muted-foreground">
            Wire Tap can't place bids for you — copy these and enter them on ESPN before waivers run.
          </p>
        </section>
      )}

      <section className="space-y-3">
        <SectionLabel>Available in your league</SectionLabel>
        {players.isLoading ? (
          <Skeleton className="h-60 w-full" />
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No free agents found at this position.</p>
        ) : (
          <ul className="space-y-2">
            {list.slice(1).map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-border bg-card p-4"
                style={{ borderLeft: `4px solid ${teamColor(p.team)}` }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-bold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">score {p.score.toFixed(1)}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {p.position} · {p.team ?? "FA"} · {p.projection.toFixed(1)} pts proj
                  {p.injury ? ` · ${p.injury}` : ""}
                </p>
                <BidForm
                  player={p}
                  suggested={suggest(p)}
                  hasBudget={total !== null}
                  onSave={(amount) => {
                    upsert({ id: p.id, name: p.name, position: p.position, team: p.team, amount, suggested: suggest(p), at: Date.now() });
                    toast.success(`Planned $${amount} on ${p.name}`);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}

function Header() {
  return (
    <div>
      <h1 className="flex items-center gap-2 font-display text-3xl uppercase">
        <Gavel className="size-7 text-action" /> Waiver bids
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your budget, who's free in your league, and what to bid.
      </p>
    </div>
  );
}

function Stat({ label, value, strong, warn }: { label: string; value: string; strong?: boolean; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`font-display text-2xl ${warn ? "text-destructive" : strong ? "text-action" : ""}`}>{value}</p>
    </div>
  );
}

function BidForm({
  player,
  suggested,
  hasBudget,
  onSave,
}: {
  player: RankedPlayer;
  suggested: number;
  hasBudget: boolean;
  onSave: (amount: number) => void;
}) {
  const [value, setValue] = useState<string>("");
  const amount = value === "" ? suggested : Math.max(0, Math.round(Number(value) || 0));
  return (
    <form
      className="mt-3 flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(amount);
        setValue("");
      }}
    >
      {hasBudget && (
        <div className="relative w-24">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
          <Input
            aria-label={`Bid on ${player.name}`}
            inputMode="numeric"
            className="pl-6"
            placeholder={String(suggested)}
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
          />
        </div>
      )}
      <Button type="submit" size="sm">{hasBudget ? "Plan bid" : "Add to list"}</Button>
      {hasBudget && <span className="text-xs text-muted-foreground">Suggested ${suggested}</span>}
    </form>
  );
}
