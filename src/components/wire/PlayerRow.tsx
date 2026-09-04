import { ChevronRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";

import { PlayerDetail } from "./PlayerDetail";
import type { RankedPlayer, ScoringFormat } from "@/lib/ranking";
import { SosSection } from "./SosSection";
import { WatchButton } from "./WatchButton";
import { teamColor, teamGlowColor } from "@/lib/team-colors";
import { cn } from "@/lib/utils";

const TREND_ICON = {
  rising: TrendingUp,
  falling: TrendingDown,
  stable: Minus,
} as const;

const TREND_CLASS = {
  rising: "bg-action/15 text-turf",
  falling: "bg-destructive/10 text-destructive",
  stable: "bg-secondary text-muted-foreground",
} as const;

export function PlayerRow({
  player,
  rank,
  format = "ppr",
  isNew = false,
}: {
  player: RankedPlayer;
  rank: number;
  format?: ScoringFormat;
  isNew?: boolean;
}) {
  const TrendIcon = TREND_ICON[player.trendLabel];
  const color = teamColor(player.team);
  const isTopPick = rank === 1;
  const [open, setOpen] = useState(false);

  return (
    <>
      <article
      role="button"
      tabIndex={0}
      aria-label={`Open ${player.name} details`}
      onClick={() => setOpen(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen(true);
        }
      }}
      className={cn(
        "cursor-pointer rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isNew && "ring-2 ring-action",
      )}
      style={{
        borderColor: color,
        boxShadow: `0 0 0 1px ${teamGlowColor(player.team, 110)}, 0 4px 20px -6px ${teamGlowColor(player.team, isTopPick ? 235 : 185)}`,
      }}
    >

      <div className="flex items-stretch">
        <div
          className="flex w-11 shrink-0 flex-col items-center justify-center border-r py-3"
          style={{ backgroundColor: `${color}22`, borderRightColor: `${color}55` }}
        >
          <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
            #{rank}
          </span>
          <span
            className="font-display text-xl leading-none text-turf tabular-nums"
            title="Recommendation strength, scored 0 to 10"
          >
            {player.score.toFixed(1)}
            <span className="text-[9px] font-sans font-normal not-italic text-muted-foreground">
              /10
            </span>
          </span>
        </div>

        <div className="min-w-0 flex-1 px-3 py-2.5">
          <div className="flex items-baseline gap-2">
            <h3 className="truncate font-display text-lg uppercase leading-tight">{player.name}</h3>
            <span className="shrink-0 text-[10px] font-bold text-muted-foreground">
              {player.team ?? "FA"} • {player.position}
            </span>
            {isNew && (
              <span
                className="shrink-0 rounded bg-action px-1 py-px text-[9px] font-black uppercase tracking-wider text-action-foreground"
                title="Newly dropped under your ownership threshold"
              >
                New
              </span>
            )}
            <span className="ml-auto flex shrink-0 items-center gap-1 self-center">
              <WatchButton player={player} />
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </span>


          </div>

          <dl className="mt-1 grid grid-cols-3 gap-1 border-y border-border/70 py-1 text-[10px] font-bold uppercase tracking-tight">
            <Cell
              label={player.ownershipSource === "espn" ? "Owned · ESPN" : "Owned · est"}
              value={`${Math.round(player.ownership)}%`}
            />
            <Cell label="Proj" value={`${player.projection.toFixed(1)} pts`} />
            <div>
              <dt className="text-[9px] text-muted-foreground">Trend</dt>
              <dd
                className={cn(
                  "mt-0.5 inline-flex items-center gap-1 rounded px-1 py-px",
                  TREND_CLASS[player.trendLabel],
                )}
                title="Net roster adds vs. drops across Sleeper leagues in the last 24 hours"
              >
                <TrendIcon className="size-3" strokeWidth={3} />
                {player.trendLabel === "stable"
                  ? "Flat"
                  : `${player.trendDelta > 0 ? "+" : ""}${compact(player.trendDelta)} adds`}
              </dd>
            </div>
          </dl>

          <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{player.reason}</p>

          <SosSection sos={player.sos} />
        </div>
      </div>

      </article>

      <PlayerDetail
        player={player}
        rank={rank}
        format={format}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 tabular-nums">{value}</dd>
    </div>
  );
}

function compact(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}
