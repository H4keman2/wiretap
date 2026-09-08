import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { SectionLabel } from "./Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { connectLeague } from "@/lib/league.functions";
import { useEspnConnection, useLeagueProfile } from "@/lib/league-store";
import { FORMAT_LABEL } from "@/lib/ranking";

/**
 * "Connect my real league" panel. Reads the user's own ESPN league so
 * availability, scoring and lineup slots come from that league instead of
 * ESPN's national averages.
 */
export function LeagueConnect() {
  const { connection, save, clear, loaded } = useEspnConnection();
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

  const summary = connection.summary;

  if (!loaded) return null;

  return (
    <section className="space-y-3">
      <SectionLabel>Your ESPN league</SectionLabel>

      {summary ? (
        <div className="space-y-3 rounded-xl border border-action/50 bg-card p-4">
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

          <div>
            <label className="text-xs font-bold uppercase text-muted-foreground" htmlFor="my-team">
              Which team is yours?
            </label>
            <select
              id="my-team"
              value={connection.teamId ?? ""}
              onChange={(e) =>
                save({ teamId: e.target.value === "" ? null : Number(e.target.value) })
              }
              className="mt-2 h-9 w-full rounded-md border border-input bg-card px-2 text-sm font-bold"
            >
              <option value="">Choose your team…</option>
              {summary.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.playerCount})
                </option>
              ))}
            </select>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Waiver targets now show only players nobody in this league has rostered, scored with
            your league's own settings.
          </p>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div>
            <label className="text-xs font-bold uppercase text-muted-foreground" htmlFor="league-id">
              ESPN league ID
            </label>
            <Input
              id="league-id"
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
              placeholder="90273659"
              inputMode="numeric"
              className="mt-2 h-9 text-sm"
            />
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              It's the <span className="font-bold">leagueId</span> number in your ESPN league URL.
            </p>
          </div>

          {showCookies ? (
            <div className="space-y-3 border-t border-border pt-3">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Private leagues need the two sign-in values from your own ESPN session. In a
                browser signed in to ESPN, open developer tools → Application → Cookies →
                fantasy.espn.com, then copy <span className="font-bold">espn_s2</span> and{" "}
                <span className="font-bold">SWID</span>. They stay on this device only.
              </p>
              <div>
                <label className="text-xs font-bold uppercase text-muted-foreground" htmlFor="s2">
                  espn_s2
                </label>
                <Input
                  id="s2"
                  value={espnS2}
                  onChange={(e) => setEspnS2(e.target.value)}
                  placeholder="AEB..."
                  className="mt-2 h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-muted-foreground" htmlFor="swid">
                  SWID
                </label>
                <Input
                  id="swid"
                  value={swid}
                  onChange={(e) => setSwid(e.target.value)}
                  placeholder="{XXXXXXXX-XXXX-...}"
                  className="mt-2 h-9 text-sm"
                />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCookies(true)}
              className="text-[11px] font-bold text-turf underline"
            >
              My league is private
            </button>
          )}

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
        </div>
      )}
    </section>
  );
}
