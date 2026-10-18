import { Link } from "@tanstack/react-router";
import { Check, Eye } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The standard locked-Pro section used across the app: header with Pro badge,
 * what it does, a benefit checklist, a blurred preview, and the upsell.
 * Every premium feature uses this so they all look like one family.
 */
export function ProFeatureSection({
  icon,
  title,
  description,
  benefits,
  preview,
  feature,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  benefits: { title: string; body: string }[];
  /** Rendered blurred behind the "Preview" badge. Keep it short. */
  preview: ReactNode;
  /** Label used in the upsell, e.g. "Trade Analyzer". */
  feature: string;
}) {
  return (
    <section aria-label={`${title} — Pro feature`} className="space-y-5">
      <div>
        <h1 className="flex flex-wrap items-center gap-2 font-display text-3xl uppercase leading-none">
          <span aria-hidden="true" className="text-action">
            {icon}
          </span>
          {title}
          <span className="rounded bg-action px-1.5 py-0.5 font-sans text-[10px] font-black uppercase tracking-wider text-action-foreground">
            Pro
          </span>
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {benefits.map((b) => (
          <li
            key={b.title}
            className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-3"
          >
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-action/15">
              <Check aria-hidden="true" className="size-3 text-action" strokeWidth={3} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-tight">{b.title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{b.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="relative overflow-hidden rounded-xl border border-border">
        <div aria-hidden="true" className="pointer-events-none space-y-2 select-none p-4 blur-sm">
          {preview}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/40">
          <span className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground shadow">
            <Eye aria-hidden="true" className="size-3" />
            Preview
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-depth text-depth-foreground">
        <div className="p-5">
          <p className="font-display text-xl uppercase leading-none">{feature} is Pro</p>
          <p className="mt-2 text-xs leading-relaxed text-depth-foreground/75">
            One $4.99 season pass unlocks every Pro feature. Already bought? Enter your license key
            in Settings.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link
              to="/pro"
              className="block rounded bg-action px-4 py-3 text-center text-sm font-bold uppercase tracking-tight text-action-foreground"
            >
              See plans — $4.99
            </Link>
            <Link
              to="/settings"
              className="block rounded border border-depth-foreground/25 px-4 py-3 text-center text-sm font-bold uppercase tracking-tight text-depth-foreground"
            >
              Enter license key
            </Link>
          </div>
        </div>
        <div aria-hidden="true" className="h-1 bg-action" />
      </div>
    </section>
  );
}
