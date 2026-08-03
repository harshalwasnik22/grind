import type { ComponentProps } from "react";
import type { StatBar } from "@/components/ui/stat-bar";

type BarColor = NonNullable<ComponentProps<typeof StatBar>["color"]>;

export type CategoryMeta = {
  value: string;
  label: string;
  icon: string;
  color: BarColor;
};

export const CATEGORIES: CategoryMeta[] = [
  { value: "dsa", label: "DSA", icon: "⚔️", color: "info" },
  { value: "system_design", label: "System Design", icon: "🏛️", color: "magenta" },
  { value: "gym", label: "Gym", icon: "💪", color: "xp" },
  { value: "learning", label: "Learning", icon: "📚", color: "gold" },
  { value: "custom", label: "Custom", icon: "✨", color: "info" },
];

export function categoryMeta(value: string): CategoryMeta {
  return CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1];
}

/** Common measurement units offered as a datalist. */
export const UNITS = [
  "problems",
  "topics",
  "sessions",
  "minutes",
  "pages",
  "reps",
  "chapters",
  "tasks",
];

export const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
