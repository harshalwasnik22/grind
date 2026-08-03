"use client";

import { useActionState } from "react";
import { setWagerAction, type GroupActionState } from "@/app/groups/actions";
import { PixelButton } from "@/components/ui/pixel-button";

const initial: GroupActionState = {};

/**
 * Owner-only editor for this season's wager stake. Members see the read-only
 * stake elsewhere; this is only rendered for the squad owner.
 */
export function WagerForm({
  groupId,
  currentStake,
}: {
  groupId: string;
  currentStake: string | null;
}) {
  const [state, action, pending] = useActionState(setWagerAction, initial);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="group_id" value={groupId} />
      <div className="pixel-inset px-3 py-2">
        <input
          name="stake"
          defaultValue={currentStake ?? ""}
          maxLength={120}
          placeholder="e.g. Loser buys the squad coffee ☕"
          className="w-full bg-transparent text-lg text-fg placeholder:text-muted focus:outline-none"
        />
      </div>
      {state.error && <p className="text-base text-hp">⚠ {state.error}</p>}
      {state.ok && !state.error && (
        <p className="text-base text-xp">✔ Wager saved.</p>
      )}
      <PixelButton
        type="submit"
        variant="primary"
        disabled={pending}
        size="sm"
      >
        {pending ? "Saving…" : currentStake ? "Update Wager" : "Set Wager"}
      </PixelButton>
    </form>
  );
}
