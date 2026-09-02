import { Star } from "lucide-react";

import { useWatchlist } from "@/lib/watchlist-store";
import { cn } from "@/lib/utils";

export function WatchButton({
  player,
  size = "sm",
}: {
  player: { id: string; name: string; team: string | null; position: string };
  size?: "sm" | "md";
}) {
  const { has, toggle } = useWatchlist();
  const saved = has(player.id);

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${player.name} from watchlist` : `Save ${player.name} to watchlist`}
      title={saved ? "Saved to watchlist" : "Save to watchlist"}
      onClick={(e) => {
        e.stopPropagation();
        toggle({ id: player.id, name: player.name, team: player.team, position: player.position });
      }}
      className={cn(
        "shrink-0 rounded-md border p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        saved
          ? "border-action bg-action/15 text-action"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      <Star
        className={cn(size === "md" ? "size-4" : "size-3.5")}
        strokeWidth={2.5}
        fill={saved ? "currentColor" : "none"}
      />
    </button>
  );
}
