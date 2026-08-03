import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "muted" | "xp" | "hp" | "gold" | "info" | "magenta";

const toneClass: Record<Tone, string> = {
  muted: "text-muted border-muted/50",
  xp: "text-xp border-xp/60",
  hp: "text-hp border-hp/60",
  gold: "text-gold border-gold/60",
  info: "text-info border-info/60",
  magenta: "text-magenta border-magenta/60",
};

type PixelBadgeProps = {
  children: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
};

/** Small pixel chip for streaks, titles, achievements, etc. */
export function PixelBadge({
  children,
  tone = "muted",
  icon,
  className,
}: PixelBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border-2 bg-black/30 px-2 py-1 text-sm uppercase leading-none",
        toneClass[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
