import { Activity, AlertTriangle, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

import type { InjuryAlert } from "@/lib/injuries";

const TONE: Record<InjuryAlert["severity"], { chip: string; label: string; ring: string }> = {
  out: {
    chip: "bg-destructive text-destructive-foreground",
    label: "OUT",
    ring: "border-destructive/60",
  },
  doubtful: { chip: "bg-chart-4 text-background", label: "DOUBTFUL", ring: "border-chart-4/60" },
  questionable: {
    chip: "bg-secondary text-secondary-foreground",
    label: "QUESTIONABLE",
    ring: "border-border",
  },
};

function freshness(updatedAt: number | undefined, checking: boolean): string {
  if (checking) return "checking now";
  if (!updatedAt) return "";
  const s = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
  if (s < 60) return `checked ${s}s ago`;
  return `checked ${Math.round(s / 60)}m ago`;
}

/**
 * Injury watch for the current starting lineup: who's tagged, how likely
 * they are to sit, and the best replacement (bench first, then the wire).
 * Status is re-read on the live cycle, so this stays current without the
 * user re-running anything.
 */
export function InjuryAlerts({
  alerts,
  updatedAt,
  live = false,
  checking = false,
}: {
  alerts: InjuryAlert[];
  updatedAt?: number;
  live?: boolean;
  checking?: boolean;
}) {
  const note = freshness(updatedAt, checking);

  if (alerts.length === 0) {
    if (!live) return null;
    return (
      <section className="flex items-center gap-2 rounded-xl border border-border bg-card p-3">
        <Activity className="size-4 shrink-0 text-turf" aria-hidden="true" />
        <p className="text-[11px] text-muted-foreground">
          <span className="font-black uppercase tracking-tight text-foreground">
            All starters active
          </span>
          {note ? ` · ${note}` : ""} — we'll flag it here the moment one gets tagged.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
        <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
          Injury watch — {alerts.length} starter{alerts.length === 1 ? "" : "s"} tagged
          {note ? ` · ${note}` : ""}
        </h2>
      </div>


      <div className="space-y-2">
        {alerts.map((a) => {
          const tone = TONE[a.severity];
          return (
            <article
              key={a.playerId}
              className={cn("rounded-xl border-2 bg-card p-3", tone.ring)}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">
                    {a.playerName}{" "}
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {a.team ?? "FA"} · {a.position}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {a.verdict}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black tracking-wide",
                    tone.chip,
                  )}
                >
                  {tone.label}
                </span>
              </div>

              {a.best ? (
                <div className="mt-2.5 space-y-1.5">
                  <div className="flex items-center gap-2 rounded-lg bg-secondary/60 px-2.5 py-2">
                    <ArrowRight className="size-4 shrink-0 text-action" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold">
                        Start {a.best.name}{" "}
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {a.best.team ?? "FA"} · {a.best.position}
                        </span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {a.best.source === "bench"
                          ? "Already on your bench"
                          : `Free agent · ${a.best.ownership}% owned`}{" "}
                        · {a.best.projection} proj pts
                      </p>
                    </div>
                  </div>

                  {a.options.length > 1 && (
                    <details className="px-1">
                      <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        Other options ({a.options.length - 1})
                      </summary>
                      <ul className="mt-1 space-y-1 text-[11px] text-muted-foreground">
                        {a.options.slice(1).map((o) => (
                          <li key={o.id} className="flex items-center justify-between gap-2">
                            <span className="truncate">
                              {o.name}{" "}
                              <span className="text-[9px] font-bold">
                                {o.position} · {o.source === "bench" ? "bench" : "wire"}
                              </span>
                            </span>
                            <span className="shrink-0 tabular-nums">{o.projection} pts</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ) : (
                <p className="mt-2.5 rounded-lg bg-secondary/60 px-2.5 py-2 text-[11px] text-muted-foreground">
                  No healthy replacement on your bench or the wire at this spot — check back closer
                  to kickoff.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
