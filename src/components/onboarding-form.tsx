"use client";

import { useActionState, useEffect, useState } from "react";
import {
  completeOnboarding,
  type OnboardingState,
} from "@/app/onboarding/actions";
import { PixelButton } from "@/components/ui/pixel-button";

const initialState: OnboardingState = {};

type Props = {
  defaultName?: string;
  defaultUsername?: string;
  defaultTimezone?: string;
  timezones: string[];
};

export function OnboardingForm({
  defaultName = "",
  defaultUsername = "",
  defaultTimezone = "UTC",
  timezones,
}: Props) {
  const [state, action, pending] = useActionState(
    completeOnboarding,
    initialState,
  );
  const [timezone, setTimezone] = useState(defaultTimezone);

  // Best-effort: default the timezone select to the player's local zone.
  useEffect(() => {
    if (defaultTimezone !== "UTC") return;
    try {
      const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (local && timezones.includes(local)) setTimezone(local);
    } catch {
      /* keep UTC */
    }
  }, [defaultTimezone, timezones]);

  return (
    <form action={action} className="space-y-5">
      <label className="block">
        <span className="pixel-title text-[0.5rem] uppercase text-muted">
          Display name
        </span>
        <div className="pixel-inset mt-2 px-3 py-2">
          <input
            name="display_name"
            defaultValue={defaultName}
            required
            minLength={2}
            maxLength={40}
            placeholder="Your hero name"
            className="w-full bg-transparent text-lg text-fg placeholder:text-muted focus:outline-none"
          />
        </div>
      </label>

      <label className="block">
        <span className="pixel-title text-[0.5rem] uppercase text-muted">
          Handle <span className="text-muted/70">(optional)</span>
        </span>
        <div className="pixel-inset mt-2 flex items-center px-3 py-2">
          <span className="text-lg text-muted">@</span>
          <input
            name="username"
            defaultValue={defaultUsername}
            maxLength={20}
            placeholder="grindlord"
            className="w-full bg-transparent text-lg text-fg placeholder:text-muted focus:outline-none"
          />
        </div>
      </label>

      <label className="block">
        <span className="pixel-title text-[0.5rem] uppercase text-muted">
          Timezone
        </span>
        <div className="pixel-inset mt-2 px-3 py-2">
          <select
            name="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full bg-transparent text-lg text-fg focus:outline-none"
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz} className="bg-surface text-fg">
                {tz}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-1 text-sm text-muted">
          Used to close out your day and streak at your local midnight.
        </p>
      </label>

      {state.error && <p className="text-base text-hp">⚠ {state.error}</p>}

      <PixelButton
        type="submit"
        variant="primary"
        disabled={pending}
        className="w-full"
      >
        {pending ? "Saving…" : "Enter the Arena"}
      </PixelButton>
    </form>
  );
}
