import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Check,
  ClipboardList,
  Lock,
  Minus,
  Radar,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

import { Page, ProxyNote, SectionLabel } from "@/components/wire/Shell";
import { getProInfo } from "@/lib/pro.functions";

export const Route = createFileRoute("/pro")({
  head: () => ({
    meta: [
      { title: "Team Analyzer — $4.99 Season Pass | Wire Tap" },
      {
        name: "description",
        content:
          "Wire Tap Pro: enter your fantasy football roster once and get positional weakness scoring, auto-flagged weak spots, live injury alerts with substitutions, and ranked waiver targets for the positions your team actually needs. $4.99 for the season.",
      },
      { property: "og:title", content: "Wire Tap Pro — Team Analyzer, $4.99/season" },
      {
        property: "og:description",
        content:
          "Enter your roster, see your weakest positions with the math shown, get live injury alerts with named replacements, and ranked waiver targets for exactly the spots you need. $4.99 season pass.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProPage,
});

const INCLUDED = [
  {
    icon: BarChart3,
    title: "Positional weakness scoring",
    body: "Every starting spot is scored against replacement-level output for your format, with bench depth factored in. You see the math, not a black-box number.",
  },
  {
    icon: Radar,
    title: "Auto-flagged weak spots",
    body: "Wire Tap surfaces your weakest positions and ranks them: \"Your weakest are RB, then TE.\" A manual override lets you pick any position anyway.",
  },
  {
    icon: ShieldCheck,
    title: "Live injury alerts",
    body: "When a starter is ruled out or cleared, the analyzer re-scores within a minute and names the best legal replacement for the exact slot he filled.",
  },
  {
    icon: TrendingUp,
    title: "Ranked waiver targets for your needs",
    body: "Recommendations pull players at your flagged position, scored for your format and filtered by how widely rostered they are — same engine as the free browser.",
  },
  {
    icon: ClipboardList,
    title: "Reusable league profile",
    body: "Set your lineup slots and bench size once. Wire Tap remembers your league every week, so re-running the analysis is one tap, not a re-entry.",
  },
  {
    icon: Users,
    title: "Works with your real league",
    body: "Connect an ESPN league and ownership numbers, free agents, and scoring come straight from your league — not the national average.",
  },
] as const;

const COMPARE = [
  { label: "Browse waiver targets by position", free: true, pro: true },
  { label: "Format-aware rankings (PPR / half / standard)", free: true, pro: true },
  { label: "Ownership threshold slider", free: true, pro: true },
  { label: "Live waiver watch + watchlist", free: true, pro: true },
  { label: "Roster entry + positional weakness scoring", free: false, pro: true },
  { label: "Auto-flagged weakest positions, with reasoning", free: false, pro: true },
  { label: "Live injury alerts with named substitutions", free: false, pro: true },
  { label: "Connect your ESPN league for real ownership", free: false, pro: true },
  { label: "Reusable league profile across weeks", free: false, pro: true },
] as const;

const STEPS = [
  { n: 1, title: "Set your league", body: "Pick your format, lineup slots, and bench size once. Wire Tap saves it." },
  { n: 2, title: "Enter your roster", body: "Type names or pull them straight from your connected ESPN league team." },
  { n: 3, title: "See your weak spots", body: "Get a ranked list of your weakest positions, with the scoring shown, plus matching waiver targets." },
] as const;

const FAQ = [
  {
    q: "How long does a season pass last?",
    a: "One full NFL regular season and playoffs. Re-run the analyzer every week as your roster changes — there's no per-run limit.",
  },
  {
    q: "Do I need to connect a league to use it?",
    a: "No. The Team Analyzer works with a manually entered roster on any platform (Sleeper, ESPN, Yahoo, NFL.com). Connecting an ESPN league just makes ownership and free-agent data match your league exactly.",
  },
  {
    q: "Is the free waiver browser still free?",
    a: "Yes, always. Browsing ranked waiver targets by position, the ownership threshold, live watch, and your watchlist stay free with no account. The pass only unlocks the roster analyzer.",
  },
  {
    q: "How do I activate after buying?",
    a: "After checkout you get a license key. Paste it in Settings → Pro access (or the box on the analyzer) and it's verified against your purchase — not just checked for the right shape.",
  },
] as const;

function ProPage() {
  const { data: proInfo } = useQuery({
    queryKey: ["pro-info"],
    queryFn: () => getProInfo({ data: undefined }),
    staleTime: 1000 * 60 * 60,
  });

  const buyUrl = proInfo?.gumroadUrl ?? null;
  const buyBroken = proInfo && !proInfo.urlLikelyValid;

  return (
    <Page format="ppr">
      {/* Hero -------------------------------------------------------- */}
      <section className="relative isolate overflow-hidden rounded-xl bg-depth px-5 py-7 text-depth-foreground">
        <div className="relative z-10 space-y-4">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-action/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-action">
            <Sparkles className="size-3" strokeWidth={3} />
            Wire Tap Pro
          </p>

          <h1 className="font-display text-3xl uppercase leading-[0.95]">
            Know which position your team actually needs
          </h1>

          <p className="text-sm leading-relaxed text-depth-foreground/75">
            Enter your roster once. Wire Tap scores every position against replacement level, flags your
            weakest spots with the math shown, and pulls matching waiver targets — plus live injury alerts
            that name the best substitute the moment a starter is ruled out.
          </p>

          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-display text-4xl uppercase leading-none text-action">
              {proInfo?.price ?? "$4.99"}
            </span>
            <span className="text-xs font-bold uppercase tracking-tight text-depth-foreground/60">
              for the season
            </span>
          </div>

          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            {buyUrl ? (
              <a
                href={buyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded bg-action px-4 py-3 text-sm font-bold uppercase tracking-tight text-action-foreground"
              >
                Get the season pass
                <ArrowRight className="size-4" strokeWidth={3} />
              </a>
            ) : (
              <Link
                to="/settings"
                className="flex items-center justify-center gap-2 rounded bg-action px-4 py-3 text-sm font-bold uppercase tracking-tight text-action-foreground"
              >
                Enter license key
                <ArrowRight className="size-4" strokeWidth={3} />
              </Link>
            )}
            <a
              href="#features"
              className="flex items-center justify-center rounded border border-depth-foreground/25 px-4 py-3 text-sm font-bold uppercase tracking-tight text-depth-foreground"
            >
              See what's included
            </a>
          </div>

          {buyBroken && (
            <p className="text-[11px] leading-relaxed text-warn">
              The buy link isn't fully configured yet — if checkout doesn't open, grab a key from your
              Gumroad product page and paste it in Settings.
            </p>
          )}
        </div>

        <div className="pointer-events-none absolute -right-8 -top-10 -z-10 size-40 rounded-full border border-depth-foreground/10" />
        <div className="pointer-events-none absolute -bottom-16 -right-16 -z-10 size-56 rounded-full border border-depth-foreground/10" />
      </section>

      {/* Free vs Pro ------------------------------------------------ */}
      <section className="space-y-3">
        <SectionLabel>Free vs Pro</SectionLabel>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-b border-border bg-muted/40 px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            <span>Feature</span>
            <span className="w-12 text-center">Free</span>
            <span className="w-12 text-center text-action">Pro</span>
          </div>
          {COMPARE.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-b border-border px-3 py-2.5 last:border-0"
            >
              <span className="text-xs leading-snug text-foreground">{row.label}</span>
              <span className="flex w-12 justify-center">
                {row.free ? (
                  <Check className="size-4 text-turf" strokeWidth={3} />
                ) : (
                  <Minus className="size-4 text-muted-foreground/50" strokeWidth={3} />
                )}
              </span>
              <span className="flex w-12 justify-center">
                {row.pro ? (
                  <Check className="size-4 text-action" strokeWidth={3} />
                ) : (
                  <X className="size-4 text-muted-foreground/50" strokeWidth={3} />
                )}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* What's included ------------------------------------------- */}
      <section id="features" className="scroll-mt-32 space-y-3">
        <SectionLabel>What's included</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          {INCLUDED.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-4">
              <span className="flex size-7 items-center justify-center rounded-lg bg-action/15 text-action">
                <Icon className="size-4" strokeWidth={2.5} />
              </span>
              <p className="mt-2.5 text-xs font-bold uppercase tracking-tight">{title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works ---------------------------------------------- */}
      <section className="space-y-3">
        <SectionLabel>How it works</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-xl border border-border bg-card p-4">
              <span className="flex size-6 items-center justify-center rounded-full bg-action/15 text-[11px] font-black text-action">
                {s.n}
              </span>
              <p className="mt-2 text-xs font-bold uppercase tracking-tight">{s.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ ------------------------------------------------------- */}
      <section className="space-y-3">
        <SectionLabel>FAQ</SectionLabel>
        <div className="space-y-2">
          {FAQ.map((item) => (
            <details key={item.q} className="group rounded-xl border border-border bg-card p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-bold">
                {item.q}
                <span className="text-action transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Bottom CTA ------------------------------------------------ */}
      <section className="relative overflow-hidden rounded-xl border-b-4 border-action bg-depth p-5 text-depth-foreground">
        <Lock className="mb-3 size-6 text-action" />
        <p className="font-display text-2xl uppercase leading-none">Stop guessing. Start targeting.</p>
        <p className="mt-2 text-xs leading-relaxed text-depth-foreground/75">
          One season pass, unlimited re-runs. Your roster changes every week — your weak spots shouldn't be
          a guess.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {buyUrl ? (
            <a
              href={buyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded bg-action px-4 py-3 text-sm font-bold uppercase tracking-tight text-action-foreground"
            >
              Get the season pass — {proInfo?.price ?? "$4.99"}
              <ArrowRight className="size-4" strokeWidth={3} />
            </a>
          ) : (
            <Link
              to="/settings"
              className="flex items-center justify-center gap-2 rounded bg-action px-4 py-3 text-sm font-bold uppercase tracking-tight text-action-foreground"
            >
              Enter license key
              <ArrowRight className="size-4" strokeWidth={3} />
            </Link>
          )}
          <Link
            to="/analyzer"
            className="flex items-center justify-center rounded border border-depth-foreground/25 px-4 py-3 text-sm font-bold uppercase tracking-tight text-depth-foreground"
          >
            Try the analyzer
          </Link>
        </div>
      </section>

      <ProxyNote />
    </Page>
  );
}
