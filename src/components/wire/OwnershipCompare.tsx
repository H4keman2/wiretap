import { Link } from "@tanstack/react-router";

import type { RankedPlayer } from "@/lib/ranking";
import { SectionLabel } from "./Shell";
import { teamColor } from "@/lib/team-colors";

/**
 * Side-by-side ownership: how available a player is in the user's own league
 * versus how widely rostered he is nationally on ESPN. A big gap means the
 * rest of the country wants him and nobody in this league has taken him yet.
 */
export function OwnershipCompare({
  players,
  connected,
  leagueName,
}: {
  players: RankedPlayer[] | undefined;
  connected: boolean;
  leagueName?: string | null;
}) {
  if (!connected) {
    return (
      <section className="space-y-3">
        <SectionLabel>Your league vs ESPN</SectionLabel>
        <p className="rounded-xl border border-border bg-card p-4 text-[11px] leading-relaxed text-muted-foreground">
          Connect your league in{" "}
          <Link to="/settings" className="font-bold text-turf underline">
            Settings
          </Link>{" "}
          to compare who's still free in your league against how widely rostered they are on ESPN.
        </p>
      </section>
    );
  }

  const rows = (players ?? [])
    .map((p) => ({
      player: p,
      league: p.ownershipSource === "league" ? 0 : Math.round(p.ownership),
      national: Math.round(p.nationalOwnership ?? p.ownership),
    }))
    .map((r) => ({ ...r, gap: r.national - r.league }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 8);

  if (rows.length === 0) return null;

  return (
    <section className="space-y-3">
      <SectionLabel>Your league vs ESPN</SectionLabel>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border px-4 py-2 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
          <span>Player</span>
          <span className="w-24 text-right">{leagueName ? "Your league" : "League"}</span>
          <span className="w-16 text-right">ESPN</span>
        </div>
        <ul>
          {rows.map(({ player, league, national, gap }) => (
            <li
              key={player.id}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border/60 px-4 py-2.5 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-bold uppercase">{player.name}</p>
                <p className="text-[10px] font-bold text-muted-foreground">
                  {player.team ?? "FA"} • {player.position}
                </p>
              </div>

              <div className="w-24 text-right">
                <span className="text-[11px] font-black uppercase tabular-nums text-turf">
                  {league === 0 ? "Free" : `${league}%`}
                </span>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-action"
                    style={{
                      width: `${league}%`,
                      backgroundColor: teamColor(player.team),
                    }}
                  />
                </div>
              </div>

              <div className="w-16 text-right">
                <span className="text-[11px] font-black tabular-nums">{national}%</span>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, national)}%`,
                      backgroundColor: teamColor(player.team),
                    }}
                  />
                </div>
                {gap >= 20 && (
                  <span
                    className="mt-1 inline-block rounded bg-action/15 px-1 text-[9px] font-black uppercase tracking-wider text-turf"
                    title="Widely rostered elsewhere, still free in your league"
                  >
                    Value
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Players marked "Value" are rostered by a lot of ESPN leagues but are still unclaimed in
        yours.
      </p>
    </section>
  );
}
