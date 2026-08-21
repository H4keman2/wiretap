import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Page, SectionLabel } from "@/components/wire/Shell";
import { useLeagueProfile, usePro } from "@/lib/league-store";
import type { SlotPosition } from "@/lib/ranking";
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
  const { isPro, activate, deactivate, checking } = usePro();
  const [license, setLicense] = useState("");

  const setSlot = (slot: keyof LeagueConfig, value: number) =>
    update({ config: { ...profile.config, [slot]: Math.max(0, Math.min(9, value)) } });

  return (
    <Page format={profile.format}>
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
              <Button variant="outline" size="sm" onClick={deactivate}>
                Remove key
              </Button>
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
                  placeholder="WT-XXXX-XXXX"
                  className="h-9 text-sm uppercase"
                />
                <Button
                  size="sm"
                  className="h-9"
                  disabled={checking || !license.trim()}
                  onClick={async () => {
                    const ok = await activate(license);
                    if (ok) toast.success("Team Analyzer unlocked");
                    else toast.error("That key doesn't look right");
                  }}
                >
                  {checking ? "Checking…" : "Activate"}
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Your key is verified against your purchase, not just checked for the right shape.
              </p>
            </>
          )}
        </div>
      </section>
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
    <div className="flex items-center justify-between px-3 py-2">
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
        <span className="w-5 text-center text-sm font-black tabular-nums">{value}</span>
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
