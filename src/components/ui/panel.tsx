import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PanelProps = {
  children: ReactNode;
  className?: string;
  /** Optional title rendered in a pixel-font header bar. */
  title?: ReactNode;
  /** Optional node rendered on the right side of the header. */
  action?: ReactNode;
};

/** Raised pixel panel — the primary surface for HUD content. */
export function Panel({ children, className, title, action }: PanelProps) {
  return (
    <section className={cn("pixel-panel", className)}>
      {title != null && (
        <header className="flex items-center justify-between gap-3 border-b-[3px] border-line/30 px-4 py-2">
          <h2 className="pixel-title text-[0.6rem] uppercase text-gold">
            {title}
          </h2>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
