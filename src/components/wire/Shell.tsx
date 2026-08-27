import { Link } from "@tanstack/react-router";
import { ClipboardList, ListFilter, Settings2 } from "lucide-react";
import type { ReactNode } from "react";

import { FORMAT_LABEL, type ScoringFormat } from "@/lib/ranking";
import { SosStatusIndicator } from "@/components/wire/SosStatusIndicator";

export function AppHeader({ format }: { format: ScoringFormat }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between bg-depth px-4 py-3 shadow-md">
      <Link to="/" className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded bg-action">
          <span className="h-4 w-1 rotate-12 rounded-full bg-depth" />
          <span className="h-4 w-1 -rotate-12 rounded-full bg-depth" />
        </span>
        <span className="font-display text-2xl uppercase tracking-tight text-depth-foreground">
          Wire Tap
        </span>
      </Link>
      <div className="flex items-center gap-2">
        <SosStatusIndicator />
        <div className="rounded-full bg-depth-foreground/10 px-3 py-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-action">
            {FORMAT_LABEL[format]}
          </span>
        </div>
      </div>
    </header>
  );
}

const TABS = [
  { to: "/", label: "Waiver", icon: ListFilter },
  { to: "/analyzer", label: "Roster", icon: ClipboardList },
  { to: "/settings", label: "Settings", icon: Settings2 },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-around border-t border-border bg-card px-6 py-3">
      {TABS.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact: to === "/" }}
          className="flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-muted-foreground transition-colors"
          activeProps={{ className: "bg-action/15 text-action" }}
        >
          <Icon className="size-5" strokeWidth={2.5} />
          <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
        </Link>
      ))}
    </nav>
  );
}

export function Page({ format, children }: { format: ScoringFormat; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <AppHeader format={format} />
      <main className="mx-auto max-w-lg space-y-6 p-4 pb-28 md:max-w-3xl">{children}</main>
      <BottomNav />
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
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
