"use client";

import { useState } from "react";
import { PixelButton } from "@/components/ui/pixel-button";

export function CopyInviteButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <PixelButton
      size="sm"
      variant="gold"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable — the code is shown on screen anyway */
        }
      }}
    >
      {copied ? "Copied!" : "Copy Code"}
    </PixelButton>
  );
}
