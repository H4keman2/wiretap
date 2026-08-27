import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

import { getSosHealthStatus } from "@/lib/sos-debug.functions";

function ageAgo(iso: string | null): string {
  if (!iso) return "never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown";
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

/**
 * Compact navbar indicator for SOS coverage health. Shares the `sos-health`
 * query cache with the in-page warning banner so both stay in sync.
 */
export function SosStatusIndicator() {
  const { data, isFetching } = useQuery({
    queryKey: ["sos-health"],
    queryFn: () => getSosHealthStatus(),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 15,
  });

  const probing = isFetching || data?.willReprobe;
  const degraded = data?.degraded;

  if (degraded) {
    return (
      <div
        role="status"
        aria-busy={probing}
        title={`Schedule incomplete — ${data!.teamsWithMatchups}/${data!.threshold} teams. ${
          probing ? "Re-probing…" : "Re-probe queued."
        } Last probe: ${ageAgo(data!.lastProbeAt)}`}
        className="flex items-center gap-1.5 rounded-full bg-destructive/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-destructive"
      >
        {probing ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <AlertTriangle className="size-3" />
        )}
        <span className="hidden sm:inline">
          {probing ? "SOS re-probing" : `${data!.teamsWithMatchups}/${data!.threshold}`}
        </span>
      </div>
    );
  }

  return (
    <div
      title={`Schedule OK — ${data ? data.teamsWithMatchups : 0}/${data?.threshold ?? 0} teams. Last probe: ${ageAgo(data?.lastProbeAt ?? null)}`}
      className="flex items-center gap-1.5 rounded-full bg-action/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-action"
    >
      <CheckCircle2 className="size-3" />
      <span className="hidden sm:inline">SOS</span>
    </div>
  );
}
