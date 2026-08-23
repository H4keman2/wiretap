import type { TeamSos } from "@/lib/sos";
import { teamColor } from "@/lib/team-colors";
import { cn } from "@/lib/utils";

const GRADE_CLASS: Record<TeamSos["grade"], string> = {
  A: "bg-action/20 text-turf",
  B: "bg-action/15 text-turf",
  C: "bg-secondary text-muted-foreground",
  D: "bg-destructive/10 text-destructive",
  F: "bg-destructive/20 text-destructive",
};

const LABEL_TEXT: Record<TeamSos["label"], string> = {
  easy: "Soft slate",
  favorable: "Favorable slate",
  neutral: "Neutral slate",
  tough: "Tough slate",
  brutal: "Brutal slate",
};

export function SosSection({ sos }: { sos: TeamSos | null | undefined }) {
  if (!sos || sos.matchups.length === 0) {
    return (
      <section className="mt-1.5 border-t border-border/70 pt-1.5">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            Strength of schedule
          </h4>
          <span className="text-[10px] font-bold uppercase text-muted-foreground">
            Schedule pending
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-1.5 border-t border-border/70 pt-1.5">
      <div className="flex items-center justify-between gap-2">
        <h4
          className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground"
          title="Strength of schedule: how tough the next matchups are, from last season's points allowed by each opponent"
        >
          Strength of schedule
        </h4>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase text-muted-foreground">
            {LABEL_TEXT[sos.label]}
          </span>
          <span
            className={cn(
              "rounded px-1.5 py-px font-display text-xs leading-tight tabular-nums",
              GRADE_CLASS[sos.grade],
            )}
            title={`Average matchup difficulty ${sos.rating.toFixed(1)} out of 10`}
          >
            {sos.grade}
          </span>
        </div>
      </div>

      <ol className="mt-1 grid grid-cols-4 gap-1">
        {sos.matchups.map((m) => {
          const color = teamColor(m.opponent);
          return (
            <li
              key={m.week}
              className="rounded border px-1 py-0.5 text-center"
              style={{ borderColor: `${color}66`, backgroundColor: `${color}14` }}
              title={`Week ${m.week} ${m.home ? "vs" : "at"} ${m.opponent} — difficulty ${m.difficulty.toFixed(1)}/10`}
            >
              <span className="block text-[8px] font-bold uppercase text-muted-foreground">
                W{m.week}
              </span>
              <span className="block text-[10px] font-bold uppercase leading-tight">
                {m.home ? "" : "@"}
                {m.opponent}
              </span>
              <span className="block text-[9px] tabular-nums text-muted-foreground">
                {m.difficulty.toFixed(1)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
