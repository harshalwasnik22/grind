"use client";

import { useActionState } from "react";
import {
  createGroupAction,
  type GroupActionState,
} from "@/app/groups/actions";
import { PixelButton } from "@/components/ui/pixel-button";

const initial: GroupActionState = {};

export function CreateGroupForm() {
  const [state, action, pending] = useActionState(createGroupAction, initial);

  return (
    <form action={action} className="space-y-3">
      <div className="pixel-inset px-3 py-2">
        <input
          name="name"
          maxLength={40}
          placeholder="Squad name (e.g. The Grinders)"
          className="w-full bg-transparent text-lg text-fg placeholder:text-muted focus:outline-none"
        />
      </div>
      {state.error && <p className="text-base text-hp">⚠ {state.error}</p>}
      <PixelButton
        type="submit"
        variant="primary"
        disabled={pending}
        className="w-full"
      >
        {pending ? "Creating…" : "Create Squad"}
      </PixelButton>
    </form>
  );
}
