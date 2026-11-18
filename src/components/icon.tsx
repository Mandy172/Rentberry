import { cn } from "@/lib/utils";

type IconProps = { name: string; className?: string | undefined; filled?: boolean | undefined; size?: number | undefined; label?: string | undefined };

/** Material Symbols Rounded glyph. Decorative unless a `label` is provided. */
export function Icon({ name, className, filled, size, label }: IconProps) {
  return (
    <span
      className={cn("material-symbols-rounded shrink-0", className)}
      style={{ fontSize: size, fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {name}
    </span>
  );
}
