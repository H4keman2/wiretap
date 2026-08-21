import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import type { RankedPlayer } from "@/lib/ranking";
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

export function PlayerRow({ player, rank }: { player: RankedPlayer; rank: number }) {
  const TrendIcon = TREND_ICON[player.trendLabel];

  return (
    <article className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-stretch">
        <div className="flex w-11 shrink-0 flex-col items-center justify-center border-r border-border bg-secondary/60 py-3">
          <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
            #{rank}
          </span>
          <span className="font-display text-xl leading-none text-turf tabular-nums">
            {player.score.toFixed(1)}
          </span>
        </div>

        <div className="min-w-0 flex-1 px-3 py-2.5">
          <div className="flex items-baseline gap-2">
            <h3 className="truncate font-display text-lg uppercase leading-tight">{player.name}</h3>
            <span className="shrink-0 text-[10px] font-bold text-muted-foreground">
              {player.team ?? "FA"} • {player.position}
            </span>
          </div>

          <dl className="mt-1 grid grid-cols-3 gap-1 border-y border-border/70 py-1 text-[10px] font-bold uppercase tracking-tight">
            <Cell label="Owned" value={`${Math.round(player.ownership)}%`} />
            <Cell label="Proj" value={`${player.projection.toFixed(1)}`} />
            <div>
              <dt className="text-[9px] text-muted-foreground">Trend</dt>
              <dd
                className={cn(
                  "mt-0.5 inline-flex items-center gap-1 rounded px-1 py-px",
                  TREND_CLASS[player.trendLabel],
                )}
              >
                <TrendIcon className="size-3" strokeWidth={3} />
                {player.trendLabel === "stable"
                  ? "Flat"
                  : `${player.trendDelta > 0 ? "+" : ""}${compact(player.trendDelta)}`}
              </dd>
            </div>
          </dl>

          <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{player.reason}</p>
        </div>
      </div>
    </article>
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
