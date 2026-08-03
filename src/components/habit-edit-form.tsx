"use client";

import { useActionState } from "react";
import { updateHabit, type HabitActionState } from "@/app/habits/actions";
import { HabitFields } from "@/components/habit-fields";
import { PixelButton } from "@/components/ui/pixel-button";
import type { Habit } from "@/lib/habits";

const initial: HabitActionState = {};

export function HabitEditForm({ habit }: { habit: Habit }) {
  const [state, action, pending] = useActionState(updateHabit, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={habit.id} />
      <HabitFields
        defaultName={habit.name}
        defaultCategory={habit.category}
        defaultUnit={habit.unit}
        defaultTarget={habit.daily_target}
        defaultBaseXp={habit.base_xp}
        defaultDays={habit.schedule}
      />
      {state.error && <p className="text-base text-hp">⚠ {state.error}</p>}
      {state.ok && <p className="text-base text-xp">✓ Saved!</p>}
      <PixelButton type="submit" variant="primary" disabled={pending} size="sm">
        {pending ? "Saving…" : "Save Changes"}
      </PixelButton>
    </form>
  );
}
