import { Link } from "@tanstack/react-router";
import logoMark from "@/assets/rentberry-logo.png";
import { BRAND } from "@/lib/config";
import { cn } from "@/lib/utils";

/** `onDark` puts the berry on a cream chip so its dark outline stays visible on ink backgrounds. */
export function Logo({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2", className)}>
      <span className={cn("flex items-center justify-center", onDark && "rounded-xl bg-honey-soft p-1")}>
        <img src={logoMark} alt="" width={128} height={160} className="h-8 w-auto" />
      </span>
      <span className="font-heading text-2xl font-semibold tracking-tight">{BRAND.name}</span>
    </Link>
  );
}
