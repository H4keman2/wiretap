import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";

import { getSosHealthStatus } from "@/lib/sos-debug.functions";

/**
 * Surfaces degraded strength-of-schedule coverage. The server re-probes ESPN
 * automatically on the next request whenever coverage is below threshold, so
 * this banner disappears on its own once the feed recovers.
 */
function formatStamp(iso: string | null): string {
  if (!iso) return "never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown";
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  const ago =
    seconds < 60
      ? `${seconds}s ago`
      : seconds < 3600
        ? `${Math.round(seconds / 60)}m ago`
        : `${Math.round(seconds / 3600)}h ago`;
  return `${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} (${ago})`;
}

export function SosWarning() {
  const { data, isFetching } = useQuery({
    queryKey: ["sos-health"],
    queryFn: () => getSosHealthStatus(),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 15,
  });

  if (!data?.degraded) return null;

  const probing = isFetching || data.willReprobe;

  return (
    <div
      role="status"
      aria-busy={probing}
      className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-[11px] text-foreground"
    >
      <AlertTriangle className="mt-px size-3.5 shrink-0 text-destructive" />
      <div className="min-w-0">
        <p className="font-bold uppercase tracking-wide text-destructive">
          Schedule data incomplete
        </p>
        <p className="mt-0.5 text-muted-foreground">
          Only {data.teamsWithMatchups} of {data.threshold} teams resolved upcoming matchups, so some
          strength-of-schedule grades may show as pending.
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-wide">
          <span className="flex items-center gap-1 font-bold">
            {probing ? (
              <>
                <Loader2 className="size-3 animate-spin text-destructive" />
                <span className="text-destructive">Re-probing schedule feed…</span>
              </>
            ) : (
              <span className="text-muted-foreground">Re-probe queued for next request</span>
            )}
          </span>
          <span className="text-muted-foreground">Last probe: {formatStamp(data.lastProbeAt)}</span>
        </div>

        {data.lastError && (
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">{data.lastError}</p>
        )}
      </div>
    </div>
  );
}
