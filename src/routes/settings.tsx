import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { LeagueConnect } from "@/components/wire/LeagueConnect";
import { Page, SectionLabel } from "@/components/wire/Shell";

import { SosDebugPanel } from "@/components/wire/SosDebugPanel";
import { useLeagueProfile, usePro } from "@/lib/league-store";
import { useLiveUpdates } from "@/lib/live-updates-store";
import type { SlotPosition } from "@/lib/ranking";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/use-theme";
import type { LeagueConfig } from "@/lib/weakness";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "League Settings & Pro Access | Wire Tap" },
      {
        name: "description",
        content:
          "Save your starting lineup requirements, bench size, and scoring format as a reusable league profile, and activate Wire Tap Pro.",
      },
      { property: "og:title", content: "League Settings & Pro Access | Wire Tap" },
      {
        property: "og:description",
        content:
          "Set lineup slots and bench size once — Wire Tap remembers your league every week.",
      },
    ],
  }),
  component: SettingsPage,
});

const SLOTS: SlotPosition[] = ["QB", "RB", "WR", "TE", "FLEX", "DST", "K"];

function SettingsPage() {
  const { profile, update } = useLeagueProfile();
  const { isPro, activate, deactivate, checking, error } = usePro();
  const { theme, setTheme } = useTheme();
  const { enabled: liveUpdates, setEnabled: setLiveUpdates } = useLiveUpdates();
  const [license, setLicense] = useState("");

  const setSlot = (slot: keyof LeagueConfig, value: number) =>
    update({ config: { ...profile.config, [slot]: Math.max(0, Math.min(9, value)) } });

  return (
    <Page format={profile.format}>
      <section className="space-y-3">
        <SectionLabel>Appearance</SectionLabel>
        <div className="flex gap-2 rounded-xl border border-border bg-card p-3">
          {[
            { value: "light" as const, label: "Light" },
            { value: "dark" as const, label: "Dark" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={theme === opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-tight transition-colors",
                theme === opt.value
                  ? "border-action bg-action text-action-foreground"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionLabel>Live updates</SectionLabel>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <div>
            <p className="text-sm font-bold">Auto-refresh waiver targets</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Refreshes the waiver browser every 60s and flags newly available players. On by
              default.
            </p>
          </div>
          <Switch
            checked={liveUpdates}
            onCheckedChange={setLiveUpdates}
            aria-label="Live updates"
          />
        </div>
      </section>

      <LeagueConnect />

      <section className="space-y-3">
        <SectionLabel>League profile</SectionLabel>

        <div className="rounded-xl border border-border bg-card p-4">
          <label
            className="text-xs font-bold uppercase text-muted-foreground"
            htmlFor="league-name"
          >
            League name
          </label>
          <Input
            id="league-name"
            value={profile.name}
            onChange={(e) => update({ name: e.target.value })}
            className="mt-2 h-9 text-sm"
          />
        </div>

        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {SLOTS.map((slot) => (
            <Stepper
              key={slot}
              label={slot}
              value={profile.config[slot]}
              onChange={(v) => setSlot(slot, v)}
            />
          ))}
          <Stepper
            label="Bench"
            value={profile.config.bench}
            onChange={(v) => setSlot("bench", v)}
          />
        </div>
        <p className="px-1 text-[11px] text-muted-foreground">
          Saved automatically on this device — no re-entry next week.
        </p>
      </section>

      <section className="space-y-3">
        <SectionLabel>Pro access</SectionLabel>
        <div className="rounded-xl border border-border bg-card p-4">
          {isPro ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold">Team Analyzer unlocked</p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    Remove key
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove your license key?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You will lose Team Analyzer, league sync, and the live budget until you enter
                      the key again.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={deactivate}>Remove key</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <>
              <label
                className="text-xs font-bold uppercase text-muted-foreground"
                htmlFor="license"
              >
                License key
              </label>
              <div className="mt-2 flex gap-2">
                <Input
                  id="license"
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
                  className="h-9 text-sm uppercase"
                />
                <Button
                  size="sm"
                  className="h-9"
                  disabled={checking || !license.trim()}
                  onClick={async () => {
                    const ok = await activate(license.trim().toUpperCase());
                    if (ok) toast.success("Team Analyzer unlocked");
                  }}
                >
                  {checking ? "Checking…" : "Activate"}
                </Button>
              </div>
              {error && (
                <p role="alert" className="mt-2 text-[11px] font-bold text-red-500">
                  {error}
                </p>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                Your key is verified against your purchase, not just checked for the right shape.
                Don't have one yet?{" "}
                <Link to="/pro" className="font-bold text-turf underline">
                  Get the season pass — $4.99
                </Link>
              </p>
            </>
          )}
        </div>
      </section>

      {/* Probes raw ESPN endpoints and lists unmatched players — dev-only;
          the server function backing it also refuses to run in production. */}
      {import.meta.env.DEV && <SosDebugPanel />}
    </Page>
  );
}

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center justify-between px-3 py-2">
      <span className="font-display text-lg uppercase">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(value - 1)}
          className="size-7 rounded-md border border-border text-sm font-black"
        >
          −
        </button>
        <span aria-live="polite" className="w-5 text-center text-sm font-black tabular-nums">
          {value}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(value + 1)}
          className="size-7 rounded-md border border-border text-sm font-black"
        >
          +
        </button>
      </div>
    </div>
  );
}
