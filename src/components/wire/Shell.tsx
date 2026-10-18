import { Link } from "@tanstack/react-router";
import { ArrowLeftRight, ClipboardList, Gavel, ListFilter, Settings2, Star } from "lucide-react";
import type { ReactNode } from "react";

import type { ScoringFormat } from "@/lib/ranking";

/**
 * Just the wordmark now — the SOS coverage pill and the format badge that
 * used to live here were noise: SOS health already has its own banner when
 * something's actually wrong (SosWarning), and the format is set two taps
 * away in the controls below. Neither needed permanent header real estate.
 */
export function AppHeader() {
  return (
    <header className="flex items-center bg-depth px-4 py-3 shadow-md">
      <Link to="/" className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded bg-action">
          <span className="h-4 w-1 rotate-12 rounded-full bg-depth" />
          <span className="h-4 w-1 -rotate-12 rounded-full bg-depth" />
        </span>
        <span className="font-display text-2xl uppercase tracking-tight text-depth-foreground">
          Wire Tap
        </span>
      </Link>
    </header>
  );
}

const TABS = [
  { to: "/", label: "Waiver", icon: ListFilter },
  { to: "/bids", label: "Bids", icon: Gavel },
  { to: "/watchlist", label: "Saved", icon: Star },
  { to: "/trade", label: "Trade", icon: ArrowLeftRight },
  { to: "/analyzer", label: "Roster", icon: ClipboardList },
  { to: "/settings", label: "Settings", icon: Settings2 },
] as const;

/**
 * Moved up from a fixed bottom bar to sit right under the header. A bottom
 * bar permanently ate a strip of every screen and sat far from the content
 * it controls; up top it's in the natural reading order and frees that
 * space for actual player data on mobile.
 */
export function TopNav() {
  return (
    <nav className="flex items-center justify-around gap-1 border-b border-border bg-card px-2 py-2.5">
      {TABS.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact: to === "/" }}
          className="flex flex-col items-center gap-1 rounded-xl border border-transparent px-2 py-2 text-muted-foreground transition-all hover:border-border hover:bg-muted/50 hover:text-foreground sm:px-4"
          activeProps={{ className: "border-action/40 bg-action/15 text-action shadow-sm" }}
        >
          <Icon aria-hidden="true" className="size-5" strokeWidth={2.5} />
          <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
        </Link>
      ))}
    </nav>
  );
}

export function Page({
  format: _format,
  children,
}: {
  format: ScoringFormat;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-action focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-action-foreground"
      >
        Skip to content
      </a>
      <div className="sticky top-0 z-20">
        <AppHeader />
        <TopNav />
      </div>
      <main id="main" tabIndex={-1} className="mx-auto max-w-2xl space-y-8 p-5 sm:p-6">
        {children}
      </main>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-1 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </h2>
  );
}

export function ProxyNote() {
  return (
    <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
      Rostered % comes from ESPN Fantasy's league-wide ownership data; trending adds/drops, depth
      chart and injury tags come from Sleeper. Players ESPN doesn't list fall back to an estimate.
      Your league's actual wire may differ.
    </p>
  );
}
