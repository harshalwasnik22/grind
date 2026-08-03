import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "primary" | "danger" | "gold";
type Size = "sm" | "md";

const variantClass: Record<Variant, string> = {
  default: "bg-surface-2 text-fg",
  primary: "bg-xp/20 text-xp border-xp",
  danger: "bg-hp/20 text-hp border-hp",
  gold: "bg-gold/20 text-gold border-gold",
};

const sizeClass: Record<Size, string> = {
  sm: "text-[0.5rem] px-3 py-2",
  md: "text-[0.6rem] px-4 py-3",
};

type PixelButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

/** Pressable retro button. Pixel font, hard shadow, presses down on click. */
export function PixelButton({
  variant = "default",
  size = "md",
  className,
  type = "button",
  ...props
}: PixelButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "pixel-btn inline-flex items-center justify-center gap-2 uppercase",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...props}
    />
  );
}
