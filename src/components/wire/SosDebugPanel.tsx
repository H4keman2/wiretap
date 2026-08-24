import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/wire/Shell";
import { getSosDiagnostics } from "@/lib/sos-debug.functions";
import { cn } from "@/lib/utils";

export function SosDebugPanel() {
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ["sos-diagnostics"],
    queryFn: () => getSosDiagnostics(),
    staleTime: 0,
  });

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>SOS debug</SectionLabel>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-[10px] font-bold uppercase"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("size-3", isFetching && "animate-spin")} />
          {isFetching ? "Probing" : "Re-probe"}
        </Button>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-4 text-[11px]">
        {isError && <p className="text-destructive">Diagnostics call failed.</p>}
        {!data && !isError && <p className="text-muted-foreground">Probing ESPN endpoints…</p>}

        {data && (
          <>
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Parameters
              </h3>
              <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 tabular-nums">
                <Row label="Season" value={String(data.params.seasonYear)} />
                <Row label="Standings season" value={String(data.params.standingsSeason)} />
                <Row
                  label="Current week"
                  value={`${data.params.currentWeek} (${data.params.weekSource})`}
                />
                <Row label="Weeks requested" value={data.params.weeksRequested.join(", ") || "—"} />
              </dl>
            </div>

            <div>
              <h3 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                ESPN responses
              </h3>
              <ul className="mt-1 space-y-1">
                {data.probes.map((p) => (
                  <li key={p.label} className="rounded-md border border-border/70 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{p.label}</span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-px font-black tabular-nums",
                          p.ok
                            ? "bg-action/15 text-turf"
                            : "bg-destructive/10 text-destructive",
                        )}
                      >
                        {p.status ?? "ERR"} · {p.ms}ms
                      </span>
                    </div>
                    {p.note && <p className="mt-0.5 text-muted-foreground">{p.note}</p>}
                    <p className="mt-0.5 break-all text-[10px] text-muted-foreground/70">{p.url}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Schedule map
              </h3>
              <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 tabular-nums">
                <Row label="Teams with SOS" value={String(data.schedule.teamsWithSos)} />
                <Row label="With matchups" value={String(data.schedule.teamsWithMatchups)} />
              </dl>
              {data.schedule.sampleTeams.length > 0 && (
                <p className="mt-1 text-muted-foreground">
                  {data.schedule.sampleTeams
                    .map((t) => `${t.team} ${t.grade}/${t.rating} (${t.matchups}w)`)
                    .join(" · ")}
                </p>
              )}
            </div>

            <div>
              <h3 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Player mapping
              </h3>
              <dl className="mt-1 grid grid-cols-3 gap-x-3 gap-y-1 tabular-nums">
                <Row label="Pool" value={String(data.pool.total)} />
                <Row label="Mapped" value={String(data.pool.mapped)} />
                <Row label="Unmapped" value={String(data.pool.unmapped)} />
              </dl>
              {Object.keys(data.pool.unmappedByReason).length > 0 && (
                <p className="mt-1 text-muted-foreground">
                  {Object.entries(data.pool.unmappedByReason)
                    .map(([reason, count]) => `${reason}: ${count}`)
                    .join(" · ")}
                </p>
              )}
              {data.pool.unmappedSample.length > 0 && (
                <ul className="mt-2 max-h-52 space-y-0.5 overflow-y-auto">
                  {data.pool.unmappedSample.map((p) => (
                    <li key={p.id} className="flex items-baseline justify-between gap-2">
                      <span className="truncate">
                        {p.name}{" "}
                        <span className="text-muted-foreground">
                          {p.team ?? "FA"} · {p.position}
                        </span>
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{p.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground">
              Probed {new Date(data.generatedAt).toLocaleTimeString()} · live ESPN calls, not cached
              values.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase text-muted-foreground">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}
