import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { FORMAT_LABEL, SLOT_POSITIONS, type ScoringFormat, type SlotPosition } from "@/lib/ranking";

const FORMATS: ScoringFormat[] = ["std", "half", "ppr"];

export function FormatSelector({
  value,
  onChange,
}: {
  value: ScoringFormat;
  onChange: (v: ScoringFormat) => void;
}) {
  return (
    <div className="flex gap-2">
      {FORMATS.map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onChange(f)}
          className={cn(
            "flex-1 rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-tight transition-colors",
            value === f
              ? "border-action bg-action text-action-foreground"
              : "border-border bg-card text-muted-foreground",
          )}
        >
          {FORMAT_LABEL[f]}
        </button>
      ))}
    </div>
  );
}

export function PositionSelector({
  value,
  onChange,
}: {
  value: SlotPosition;
  onChange: (v: SlotPosition) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SLOT_POSITIONS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={cn(
            "shrink-0 rounded-lg border px-4 py-2 text-xs font-bold transition-colors",
            value === p
              ? "border-action bg-action text-action-foreground"
              : "border-border bg-card text-muted-foreground",
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

export function OwnershipSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <label className="text-xs font-bold uppercase text-muted-foreground">
          Availability threshold
        </label>
        <span className="text-sm font-black tabular-nums">&lt; {value}% Owned</span>
      </div>
      <Slider
        min={10}
        max={80}
        step={5}
        value={[value]}
        onValueChange={([v]) => onChange(v ?? 40)}
        aria-label="Ownership threshold"
      />
      <p className="mt-3 text-[11px] text-muted-foreground">
        Show players rostered in fewer than {value}% of leagues.
      </p>
    </div>
  );
}
