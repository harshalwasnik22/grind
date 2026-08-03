import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "fg" | "xp" | "gold" | "info" | "magenta" | "hp";

const toneClass: Record<Tone, string> = {
  fg: "text-fg",
  xp: "text-xp",
  gold: "text-gold",
  info: "text-info",
  magenta: "text-magenta",
  hp: "text-hp",
};

type StatTileProps = {
  label: string;
  value: ReactNode;
  /** Small line under the value (e.g. a unit or comparison). */
  note?: ReactNode;
  tone?: Tone;
  className?: string;
};

/** Recessed pixel tile for a single headline number (KPI). */
export function StatTile({
  label,
  value,
  note,
  tone = "fg",
  className,
}: StatTileProps) {
  return (
    <div className={cn("pixel-inset px-3 py-3 text-center", className)}>
      <div className="pixel-title text-[0.45rem] uppercase text-muted">
        {label}
      </div>
      <div className={cn("mt-2 pixel-title text-base tabular-nums", toneClass[tone])}>
        {value}
      </div>
      {note != null && <div className="mt-1 text-sm text-muted">{note}</div>}
    </div>
  );
}
