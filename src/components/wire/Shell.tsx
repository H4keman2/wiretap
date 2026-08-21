import { Link } from "@tanstack/react-router";
import { ClipboardList, ListFilter, Settings2 } from "lucide-react";
import type { ReactNode } from "react";

import { FORMAT_LABEL, type ScoringFormat } from "@/lib/ranking";

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
      <div className="rounded-full bg-depth-foreground/10 px-3 py-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-action">
          {FORMAT_LABEL[format]}
        </span>
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
          className="flex flex-col items-center gap-1 text-muted-foreground"
          activeProps={{ className: "text-action" }}
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
      <main className="mx-auto max-w-lg space-y-6 p-4 pb-28">{children}</main>
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
      Rostered % is estimated from league-wide Sleeper interest and add/drop volume. It is a proxy
      for availability, not a guarantee — your league's actual wire may differ.
    </p>
  );
}
