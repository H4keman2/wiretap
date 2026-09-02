import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SosSection } from "./SosSection";
import { WatchButton } from "./WatchButton";
import type { RankedPlayer, ScoringFormat } from "@/lib/ranking";
import { FORMAT_LABEL } from "@/lib/ranking";
import { perGame, seasonFantasyPoints } from "@/lib/season-stats";
import { teamColor } from "@/lib/team-colors";

const TREND_ICON = {
  rising: TrendingUp,
  falling: TrendingDown,
  stable: Minus,
} as const;

export function PlayerDetail({
  player,
  rank,
  format,
  open,
  onOpenChange,
}: {
  player: RankedPlayer;
  rank: number;
  format: ScoringFormat;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const color = teamColor(player.team);
  const TrendIcon = TREND_ICON[player.trendLabel];
  const last = player.lastSeason ?? null;
  const seasonPts = last ? seasonFantasyPoints(last, format) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[88vh] max-w-lg overflow-y-auto border-2 p-0"
        style={{ borderColor: color, boxShadow: `0 0 0 1px ${color}55, 0 18px 48px -20px ${color}` }}
      >
        <DialogHeader
          className="space-y-1 border-b p-4 text-left"
          style={{ backgroundColor: `${color}1f`, borderBottomColor: `${color}55` }}
        >
          <div className="flex items-center gap-2 pr-6">
            <DialogTitle className="font-display text-2xl uppercase leading-none">
              {player.name}
            </DialogTitle>
            <WatchButton player={player} size="md" />
          </div>
          <DialogDescription className="text-[11px] font-bold uppercase tracking-wide">
            #{rank} target • {player.team ?? "Free agent"} • {player.position} • {FORMAT_LABEL[format]}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-4 gap-2">
            <Stat label="Score" value={`${player.score.toFixed(1)}/10`} />
            <Stat label="Proj" value={`${player.projection.toFixed(1)} pts`} />
            <Stat
              label={player.ownershipSource === "espn" ? "Owned · ESPN" : "Owned · est"}
              value={`${Math.round(player.ownership)}%`}
            />
            <Stat
              label="Started"
              value={
                player.startedPct !== null && player.startedPct !== undefined
                  ? `${Math.round(player.startedPct)}%`
                  : "—"
              }
            />
            <Stat label="ADP" value={player.adp ? player.adp.toFixed(1) : "—"} />
            <Stat label="Depth" value={player.depthOrder ? `#${player.depthOrder}` : "—"} />
            <Stat label="Pos rank" value={`#${player.posRank}`} />
            <Stat label="Injury" value={player.injury ?? "None"} />
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2">
            <TrendIcon className="size-4 shrink-0 text-turf" strokeWidth={3} />
            <p className="text-[11px] font-bold uppercase tracking-tight">
              {player.addCount.toLocaleString()} adds / {player.dropCount.toLocaleString()} drops in
              24h
              {player.ownershipChange
                ? ` • ${player.ownershipChange > 0 ? "+" : ""}${player.ownershipChange.toFixed(1)}% rostered wk/wk`
                : ""}
            </p>
          </div>

          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {last ? `${last.season} season stats` : "Last season stats"}
            </h4>
            {last ? (
              <>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  <Stat label="Games" value={`${last.games}`} />
                  <Stat label={`${FORMAT_LABEL[format]} pts`} value={seasonPts.toFixed(1)} />
                  <Stat label="Pts / game" value={perGame(seasonPts, last.games).toFixed(1)} />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {last.passYds > 0 && (
                    <>
                      <Stat label="Pass yds" value={`${last.passYds}`} />
                      <Stat label="Pass TD" value={`${last.passTd}`} />
                      <Stat label="INT" value={`${last.interceptions}`} />
                    </>
                  )}
                  {last.rushAtt > 0 && (
                    <>
                      <Stat label="Carries" value={`${last.rushAtt}`} />
                      <Stat label="Rush yds" value={`${last.rushYds}`} />
                      <Stat label="Rush TD" value={`${last.rushTd}`} />
                    </>
                  )}
                  {last.targets > 0 && (
                    <>
                      <Stat label="Targets" value={`${last.targets}`} />
                      <Stat label="Rec" value={`${last.receptions}`} />
                      <Stat label="Rec yds" value={`${last.recYds}`} />
                    </>
                  )}
                  {last.recTd > 0 && <Stat label="Rec TD" value={`${last.recTd}`} />}
                </div>
              </>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                No published stat line from last season — likely a rookie or a player who did not
                see the field.
              </p>
            )}
          </section>

          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Why he is here
            </h4>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">{player.reason}</p>
          </section>

          <SosSection sos={player.sos} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-2 py-1.5">
      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate font-display text-base uppercase leading-none tabular-nums">
        {value}
      </p>
    </div>
  );
}
