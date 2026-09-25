import { useMutation } from "@tanstack/react-query";
import { Bookmark, Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { SectionLabel } from "./Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { connectLeague, importLeagueRoster } from "@/lib/league.functions";
import { useEspnConnection, useLeagueProfile } from "@/lib/league-store";
import { FORMAT_LABEL } from "@/lib/ranking";
import { cn } from "@/lib/utils";

/**
 * Guided "connect my real league" walkthrough.
 *
 * Step 1 — league ID (accepts a pasted ESPN league URL too)
 * Step 2 — private-league sign-in values, only when ESPN asks for them
 * Step 3 — pick your team and sync its roster into the analyzer
 */
export function LeagueConnect() {
  const { connection, cred, save, clear, loaded } = useEspnConnection();
  const { update } = useLeagueProfile();

  const [leagueId, setLeagueId] = useState("");
  const [espnS2, setEspnS2] = useState("");
  const [swid, setSwid] = useState("");
  const [showCookies, setShowCookies] = useState(false);

  const connect = useMutation({
    mutationFn: connectLeague,
    onSuccess: (summary) => {
      save({
        leagueId: leagueId.trim() || connection.leagueId,
        espnS2: espnS2.trim() || connection.espnS2,
        swid: swid.trim() || connection.swid,
        summary,
        teamId: connection.teamId,
      });
      update({ name: summary.name, format: summary.format, config: summary.config });
      toast.success(`Connected to ${summary.name}`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Couldn't read that league.");
      setShowCookies(true);
    },
  });

  const sync = useMutation({
    mutationFn: importLeagueRoster,
    onSuccess: ({ entries, unmatched }) => {
      update({ roster: entries });
      toast.success(
        unmatched.length
          ? `Synced ${entries.length} players — ${unmatched.length} need a manual check`
          : `Synced ${entries.length} players from your team`,
      );
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't pull that roster."),
  });

  const summary = connection.summary;

  // Pick up values handed over by the "Grab my ESPN login" bookmark. They
  // arrive in the URL hash (never sent to any server) and are wiped at once.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#espn=")) return;
    try {
      const params = new URLSearchParams(decodeURIComponent(hash.slice(6)));
      const id = params.get("leagueId") ?? "";
      const s2 = params.get("s2") ?? "";
      const sw = params.get("swid") ?? "";
      if (id) setLeagueId(id.replace(/[^\d]/g, ""));
      if (s2) setEspnS2(s2);
      if (sw) setSwid(sw);
      setShowCookies(true);
      toast.success(
        s2 && sw
          ? "ESPN details filled in — press Connect league"
          : "League ID filled in. ESPN hid your sign-in values; add them below if the league is private.",
      );
    } catch {
      toast.error("Couldn't read what the bookmark sent over.");
    }
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  if (!loaded) return null;

  /** ESPN league URLs carry the id as ?leagueId=123456 — accept a full paste. */
  const handleLeagueInput = (raw: string) => {
    const fromUrl = raw.match(/leagueId=(\d+)/i)?.[1];
    setLeagueId(fromUrl ?? raw.replace(/[^\d]/g, ""));
  };

  return (
    <section className="space-y-3">
      <SectionLabel>Your ESPN league</SectionLabel>

      {summary ? (
        <div className="space-y-4 rounded-xl border border-action/50 bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-xl uppercase leading-none">{summary.name}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {summary.size} teams · {FORMAT_LABEL[summary.format]} · {summary.season} season ·{" "}
                {summary.rosteredCount} players rostered
                {summary.faabBudget ? ` · $${summary.faabBudget} FAAB` : ""}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clear();
                toast.success("Back to league-wide numbers");
              }}
            >
              Disconnect
            </Button>
          </div>

          <Step n={3} title="Pick your team and sync it" done={connection.teamId !== null}>
            <select
              id="my-team"
              aria-label="Which team is yours?"
              value={connection.teamId ?? ""}
              onChange={(e) => save({ teamId: e.target.value === "" ? null : Number(e.target.value) })}
              className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm font-bold"
            >
              <option value="">Choose your team…</option>
              {summary.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.playerCount})
                </option>
              ))}
            </select>

            <Button
              className="mt-2 h-9 w-full"
              disabled={connection.teamId === null || sync.isPending || !cred}
              onClick={() => {
                if (!cred || connection.teamId === null) return;
                sync.mutate({ data: { ...cred, teamId: connection.teamId } });
              }}
            >
              {sync.isPending ? "Syncing your roster…" : "Sync my roster into Wire Tap"}
            </Button>

            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Waiver targets now show only players nobody in this league has rostered, scored with
              your league's own settings.
            </p>
          </Step>
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <GrabBookmark />
          <Step n={1} title="Find your league ID" done={leagueId.trim().length > 0}>
            <Input
              id="league-id"
              aria-label="ESPN league ID"
              value={leagueId}
              onChange={(e) => handleLeagueInput(e.target.value)}
              placeholder="90273659"
              inputMode="numeric"
              className="h-9 text-sm"
            />
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Open your league on ESPN and copy the <span className="font-bold">leagueId</span>{" "}
              number from the address bar — or paste the whole link here and we'll pull it out.
            </p>
          </Step>

          <Step n={2} title="Private league? Add your sign-in values" done={Boolean(espnS2 && swid)}>
            {showCookies ? (
              <div className="space-y-3">
                <ol className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                  <li>1. Sign in to ESPN in this browser.</li>
                  <li>2. Open developer tools → Application → Cookies → fantasy.espn.com.</li>
                  <li>
                    3. Copy <span className="font-bold">espn_s2</span> and{" "}
                    <span className="font-bold">SWID</span> below. They stay on this device only and
                    are never stored on our side.
                  </li>
                </ol>
                <Input
                  id="s2"
                  aria-label="espn_s2"
                  value={espnS2}
                  onChange={(e) => setEspnS2(e.target.value)}
                  placeholder="espn_s2 — AEB..."
                  className="h-9 text-sm"
                />
                <Input
                  id="swid"
                  aria-label="SWID"
                  value={swid}
                  onChange={(e) => setSwid(e.target.value)}
                  placeholder="SWID — {XXXXXXXX-XXXX-...}"
                  className="h-9 text-sm"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCookies(true)}
                className="text-[11px] font-bold text-turf underline"
              >
                My league is private — show me how
              </button>
            )}
          </Step>

          <Step n={3} title="Connect and sync" done={false}>
            <Button
              className="h-9 w-full"
              disabled={connect.isPending || !leagueId.trim()}
              onClick={() =>
                connect.mutate({
                  data: { leagueId: leagueId.trim(), espnS2: espnS2.trim(), swid: swid.trim() },
                })
              }
            >
              {connect.isPending ? "Reading your league…" : "Connect league"}
            </Button>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Next you'll pick which team is yours, then pull its roster straight into the analyzer.
            </p>
          </Step>
        </div>
      )}
    </section>
  );
}

function Step({
  n,
  title,
  done,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span
        className={cn(
          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-black",
          done ? "border-action bg-action text-action-foreground" : "border-border text-muted-foreground",
        )}
        aria-hidden
      >
        {done ? <Check className="size-3.5" /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-tight">{title}</p>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}
