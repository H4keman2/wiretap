import { useEffect, useRef, useState } from "react";
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
    <div role="group" aria-label="Scoring format" className="flex gap-3">
      {FORMATS.map((f) => (
        <button
          key={f}
          type="button"
          aria-pressed={value === f}
          onClick={() => onChange(f)}
          className={cn(
            "flex-1 rounded-lg border px-4 py-3 text-xs font-bold uppercase tracking-tight transition-colors",
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
    <div role="group" aria-label="Position" className="flex flex-wrap gap-3">
      {SLOT_POSITIONS.map((p) => (
        <button
          key={p}
          type="button"
          aria-pressed={value === p}
          onClick={() => onChange(p)}
          className={cn(
            "min-w-[3.5rem] flex-1 shrink-0 rounded-lg border px-4 py-3 text-center text-xs font-bold transition-colors",
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
  // Local display value keeps the thumb/label responsive during a drag; the
  // parent onChange fires once ~300ms after the last tick so query keys on
  // the home and analyzer pages don't re-run per 5-point tick.
  const [display, setDisplay] = useState(value);

  // Stay in sync when the parent state changes from outside (Widen pool
  // buttons set parent state directly).
  useEffect(() => {
    setDisplay(value);
  }, [value]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const handleValueChange = ([v]: number[]) => {
    const next = v ?? 40;
    setDisplay(next);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      onChangeRef.current(next);
    }, 300);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <label className="text-xs font-bold uppercase text-muted-foreground">
          Availability threshold
        </label>
        <span className="text-sm font-black tabular-nums">&lt; {display}% Owned</span>
      </div>
      <Slider
        min={10}
        max={100}
        step={5}
        value={[display]}
        onValueChange={handleValueChange}
        aria-label="Availability threshold"
      />
      <p className="mt-4 text-[11px] text-muted-foreground">
        Show players rostered in fewer than {display}% of leagues.
      </p>
    </div>
  );
}
