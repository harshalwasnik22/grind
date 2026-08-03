"use client";

import { useState, useTransition } from "react";
import { logHabit } from "@/app/log/actions";
import { StatBar } from "@/components/ui/stat-bar";
import { PixelButton } from "@/components/ui/pixel-button";
import { categoryMeta } from "@/lib/habit-meta";
import type { Habit } from "@/lib/habits";

export type QuickLogEntry = { habit: Habit; value: number };

export function QuickLog({ entries }: { entries: QuickLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-lg text-muted">
        No quests scheduled today. Add some in{" "}
        <span className="text-info">Quests</span> — or enjoy the rest day.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {entries.map((e) => (
        <QuickLogItem key={e.habit.id} habit={e.habit} initial={e.value} />
      ))}
    </div>
  );
}

function QuickLogItem({ habit, initial }: { habit: Habit; initial: number }) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const meta = categoryMeta(habit.category);
  const done = value >= habit.daily_target;

  function commit(next: number) {
    const v = Math.max(0, next);
    setValue(v);
    startTransition(async () => {
      await logHabit(habit.id, v);
    });
  }

  return (
    <div className={pending ? "opacity-70" : undefined}>
      <StatBar
        value={value}
        max={habit.daily_target}
        color={meta.color}
        label={`${meta.icon} ${habit.name}`}
        note={done ? "done ✓" : undefined}
        onSeek={(fraction) =>
          commit(Math.round(fraction * habit.daily_target))
        }
      />
      <div className="mt-2 flex items-center gap-2">
        <PixelButton
          size="sm"
          onClick={() => commit(value - 1)}
          disabled={pending || value <= 0}
          aria-label={`Decrease ${habit.name}`}
        >
          −
        </PixelButton>
        <PixelButton
          size="sm"
          onClick={() => commit(value + 1)}
          disabled={pending}
          aria-label={`Increase ${habit.name}`}
        >
          +
        </PixelButton>
        <PixelButton
          size="sm"
          variant={done ? "primary" : "gold"}
          onClick={() => commit(done ? value : habit.daily_target)}
          disabled={pending}
        >
          {done ? "Done" : "Complete"}
        </PixelButton>
        <span className="ml-auto text-sm text-muted">{habit.unit}</span>
      </div>
    </div>
  );
}
