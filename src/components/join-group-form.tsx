"use client";

import { useActionState } from "react";
import { joinGroupAction, type GroupActionState } from "@/app/groups/actions";
import { PixelButton } from "@/components/ui/pixel-button";

const initial: GroupActionState = {};

export function JoinGroupForm() {
  const [state, action, pending] = useActionState(joinGroupAction, initial);

  return (
    <form action={action} className="space-y-3">
      <div className="pixel-inset px-3 py-2">
        <input
          name="code"
          maxLength={6}
          placeholder="INVITE CODE"
          autoCapitalize="characters"
          className="w-full bg-transparent text-lg uppercase tracking-widest text-fg placeholder:text-muted placeholder:tracking-normal focus:outline-none"
        />
      </div>
      {state.error && <p className="text-base text-hp">⚠ {state.error}</p>}
      <PixelButton
        type="submit"
        variant="gold"
        disabled={pending}
        className="w-full"
      >
        {pending ? "Joining…" : "Join Squad"}
      </PixelButton>
    </form>
  );
}
