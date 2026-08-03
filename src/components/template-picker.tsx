"use client";

import { useActionState } from "react";
import { addTemplates, type HabitActionState } from "@/app/habits/actions";
import { categoryMeta } from "@/lib/habit-meta";
import { PixelButton } from "@/components/ui/pixel-button";
import type { HabitTemplate } from "@/lib/habits";

const initial: HabitActionState = {};

export function TemplatePicker({ templates }: { templates: HabitTemplate[] }) {
  const [state, action, pending] = useActionState(addTemplates, initial);

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-2">
        {templates.map((t) => {
          const meta = categoryMeta(t.category);
          return (
            <label
              key={t.id}
              className="pixel-inset flex cursor-pointer items-center gap-3 px-3 py-2"
            >
              <input
                type="checkbox"
                name="template"
                value={t.id}
                defaultChecked
                className="peer sr-only"
              />
              <span className="grid h-6 w-6 shrink-0 place-items-center border-2 border-muted/40 text-sm text-transparent peer-checked:border-xp peer-checked:text-xp">
                ✓
              </span>
              <span aria-hidden className="text-lg">
                {meta.icon}
              </span>
              <span className="flex-1 text-lg text-fg">{t.name}</span>
              <span className="text-sm text-muted">
                {t.default_target} {t.unit} · +{t.base_xp}xp
              </span>
            </label>
          );
        })}
      </div>
      {state.error && <p className="text-base text-hp">⚠ {state.error}</p>}
      {state.ok && <p className="text-base text-xp">✓ Added to your quests!</p>}
      <PixelButton
        type="submit"
        variant="gold"
        disabled={pending}
        className="w-full"
      >
        {pending ? "Adding…" : "Add Selected Quests"}
      </PixelButton>
    </form>
  );
}
