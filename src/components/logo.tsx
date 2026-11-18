import { Link } from "@tanstack/react-router";
import logoMark from "@/assets/logo-mark.png.asset.json";
import { BRAND } from "@/lib/config";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2", className)}>
      <img src={logoMark.url} alt="" width={44} height={34} className="h-8 w-auto" />
      <span className="font-heading text-2xl font-semibold tracking-tight">{BRAND.name}</span>
    </Link>
  );
}
