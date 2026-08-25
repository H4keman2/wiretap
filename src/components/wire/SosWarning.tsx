import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { getSosHealthStatus } from "@/lib/sos-debug.functions";

/**
 * Surfaces degraded strength-of-schedule coverage. The server re-probes ESPN
 * automatically on the next request whenever coverage is below threshold, so
 * this banner disappears on its own once the feed recovers.
 */
export function SosWarning() {
  const { data } = useQuery({
    queryKey: ["sos-health"],
    queryFn: () => getSosHealthStatus(),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });

  if (!data?.degraded) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-[11px] text-foreground"
    >
      <AlertTriangle className="mt-px size-3.5 shrink-0 text-destructive" />
      <div>
        <p className="font-bold uppercase tracking-wide text-destructive">
          Schedule data incomplete
        </p>
        <p className="mt-0.5 text-muted-foreground">
          Only {data.teamsWithMatchups} of {data.threshold} teams resolved upcoming matchups, so some
          strength-of-schedule grades may show as pending. Re-probing the schedule feed
          automatically.
        </p>
      </div>
    </div>
  );
}
