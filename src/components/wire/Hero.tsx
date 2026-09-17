import { Link } from "@tanstack/react-router";
import { Activity, ListFilter, Radar, Users } from "lucide-react";

/**
 * First-impression block. A visitor landing cold used to see nothing but
 * controls, with no statement of what the tool does or whether the data is
 * current. This states the promise, proves freshness (week + pool size +
 * last refresh), and points at the ranked list directly below.
 */

function freshLabel(updatedAt: number | undefined): string | null {
  if (!updatedAt) return null;
  const mins = Math.floor((Date.now() - updatedAt) / 60000);
  if (mins < 1) return "updated just now";
  if (mins === 1) return "updated 1 min ago";
  if (mins < 60) return `updated ${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `updated ${hrs} hr${hrs === 1 ? "" : "s"} ago`;
}

export function Hero({
  week,
  poolSize,
  updatedAt,
}: {
  week: number | null;
  poolSize: number | null;
  updatedAt?: number;
}) {
  const fresh = freshLabel(updatedAt);

  return (
    <section className="relative isolate overflow-hidden rounded-xl bg-depth px-5 py-7 text-depth-foreground">
      <div className="relative z-10 space-y-4">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-action/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-action">
          <Radar className="size-3" strokeWidth={3} />
          Waiver intel
        </p>

        <h1 className="font-display text-3xl uppercase leading-[0.95]">
          Find the pickups your league hasn&apos;t noticed yet
        </h1>

        <p className="text-sm leading-relaxed text-depth-foreground/75">
          Ranked waiver targets at every position, scored for your format and filtered to players
          who are still widely available. No account, no league login.
        </p>

        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-bold uppercase tracking-tight text-depth-foreground/70">
          {week !== null && (
            <div className="flex items-center gap-1.5">
              <Activity className="size-3.5 text-action" strokeWidth={3} />
              <dt className="sr-only">Schedule week</dt>
              <dd>Week {week}</dd>
            </div>
          )}
          {poolSize !== null && (
            <div className="flex items-center gap-1.5">
              <Users className="size-3.5 text-action" strokeWidth={3} />
              <dt className="sr-only">Targets listed</dt>
              <dd>{poolSize} targets</dd>
            </div>
          )}
          {fresh && (
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-action" aria-hidden />
              <dt className="sr-only">Data freshness</dt>
              <dd>{fresh}</dd>
            </div>
          )}
        </dl>

        <div className="flex flex-col gap-2 pt-1 sm:flex-row">
          <a
            href="#targets"
            className="flex items-center justify-center gap-2 rounded bg-action px-4 py-3 text-sm font-bold uppercase tracking-tight text-action-foreground"
          >
            <ListFilter className="size-4" strokeWidth={3} />
            See this week&apos;s targets
          </a>
          <Link
            to="/analyzer"
            className="flex items-center justify-center rounded border border-depth-foreground/25 px-4 py-3 text-sm font-bold uppercase tracking-tight text-depth-foreground"
          >
            Analyze my roster
          </Link>
        </div>
      </div>

      <div className="pointer-events-none absolute -right-8 -top-10 -z-10 size-40 rounded-full border border-depth-foreground/10" />
      <div className="pointer-events-none absolute -bottom-16 -right-16 -z-10 size-56 rounded-full border border-depth-foreground/10" />
    </section>
  );
}

const STEPS = [
  { n: 1, title: "Pick your format", body: "Standard, half-PPR or full PPR — rankings shift with it." },
  { n: 2, title: "Pick a position", body: "Or set the availability threshold to match your wire." },
  { n: 3, title: "Grab the top card", body: "Each target explains itself in a line, no table reading." },
] as const;

export function HowItWorks() {
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {STEPS.map((s) => (
        <div key={s.n} className="rounded-xl border border-border bg-card p-4">
          <span className="flex size-6 items-center justify-center rounded-full bg-action/15 text-[11px] font-black text-action">
            {s.n}
          </span>
          <p className="mt-2 text-xs font-bold uppercase tracking-tight">{s.title}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{s.body}</p>
        </div>
      ))}
    </section>
  );
}
