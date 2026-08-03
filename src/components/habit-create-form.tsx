"use client";

import { useActionState } from "react";
import { createHabit, type HabitActionState } from "@/app/habits/actions";
import { HabitFields } from "@/components/habit-fields";
import { PixelButton } from "@/components/ui/pixel-button";

const initial: HabitActionState = {};

export function HabitCreateForm() {
  const [state, action, pending] = useActionState(createHabit, initial);

  return (
    <form action={action} className="space-y-4">
      <HabitFields />
      {state.error && <p className="text-base text-hp">⚠ {state.error}</p>}
      {state.ok && <p className="text-base text-xp">✓ Quest added!</p>}
      <PixelButton
        type="submit"
        variant="primary"
        disabled={pending}
        className="w-full"
      >
        {pending ? "Adding…" : "Add Quest"}
      </PixelButton>
    </form>
  );
}
